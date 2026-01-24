import { supabase } from './supabaseClient';
import type { AdminViolation, Citation, ViolationStats, ViolationStatus } from '../types';

// ============================================
// VIOLATION MANAGEMENT
// ============================================

/**
 * Fetch violations with optional status filter
 * Note: violations without a status are treated as 'pending'
 */
export async function getViolations(
    status?: ViolationStatus | 'all',
    limit: number = 50
): Promise<AdminViolation[]> {
    let query = supabase
        .from('violations')
        .select(`
            *,
            junctions (
                name,
                latitude,
                longitude
            )
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

    // Filter by status if provided
    // 'pending' also includes null status (violations created before admin_schema was applied)
    if (status && status !== 'all') {
        if (status === 'pending') {
            // Include both explicitly pending AND null status violations
            query = query.or('status.eq.pending,status.is.null');
        } else {
            query = query.eq('status', status);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching violations:', error);
        return [];
    }

    // Normalize data: violations without status default to 'pending'
    return (data || []).map(v => ({
        ...v,
        status: v.status || 'pending'
    }));
}

/**
 * Fetch pending violations for review
 */
export async function getPendingViolations(): Promise<AdminViolation[]> {
    return getViolations('pending');
}

/**
 * Approve a violation and optionally create a citation
 */
export async function approveViolation(
    violationId: number,
    adminId: string,
    notes?: string,
    createCitation: boolean = true,
    fineAmount: number = 500
): Promise<{ success: boolean; citationId?: number; error?: string }> {
    try {
        // Update violation status
        const { error: updateError } = await supabase
            .from('violations')
            .update({
                status: 'approved',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes || null
            })
            .eq('id', violationId);

        if (updateError) {
            throw updateError;
        }

        // Create citation if requested
        if (createCitation) {
            const citationNumber = `CIT-${Date.now()}-${violationId}`;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30); // 30 days to pay

            const { data: citationData, error: citationError } = await supabase
                .from('citations')
                .insert({
                    citation_number: citationNumber,
                    violation_id: violationId,
                    fine_amount: fineAmount,
                    due_date: dueDate.toISOString().split('T')[0],
                    paid: false,
                    created_by: adminId
                })
                .select('id')
                .single();

            if (citationError) {
                console.error('Error creating citation:', citationError);
                // Violation is still approved, just no citation
                return { success: true, error: 'Citation creation failed' };
            }

            return { success: true, citationId: citationData?.id };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error approving violation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a violation
 */
export async function rejectViolation(
    violationId: number,
    adminId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('violations')
            .update({
                status: 'rejected',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes || 'Rejected by admin'
            })
            .eq('id', violationId);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Error rejecting violation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get violation statistics
 */
export async function getViolationStats(): Promise<ViolationStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Get counts by status
        const { data: violations } = await supabase
            .from('violations')
            .select('status, timestamp');

        const stats: ViolationStats = {
            total_pending: 0,
            total_approved: 0,
            total_rejected: 0,
            approved_today: 0,
            rejected_today: 0,
            total_citations: 0,
            revenue_collected: 0
        };

        violations?.forEach((v: { status: string | null; timestamp: string }) => {
            const vDate = new Date(v.timestamp);
            const isToday = vDate >= today;

            // Treat null status as 'pending' (for violations before admin_schema was applied)
            const status = v.status || 'pending';

            switch (status) {
                case 'pending':
                    stats.total_pending++;
                    break;
                case 'approved':
                    stats.total_approved++;
                    if (isToday) stats.approved_today++;
                    break;
                case 'rejected':
                    stats.total_rejected++;
                    if (isToday) stats.rejected_today++;
                    break;
            }
        });

        // Get citation stats
        const { data: citations } = await supabase
            .from('citations')
            .select('paid, fine_amount');

        if (citations) {
            stats.total_citations = citations.length;
            stats.revenue_collected = citations
                .filter((c: { paid: boolean }) => c.paid)
                .reduce((sum: number, c: { fine_amount: number }) => sum + c.fine_amount, 0);
        }

        return stats;
    } catch (error) {
        console.error('Error fetching violation stats:', error);
        return {
            total_pending: 0,
            total_approved: 0,
            total_rejected: 0,
            approved_today: 0,
            rejected_today: 0,
            total_citations: 0,
            revenue_collected: 0
        };
    }
}

// ============================================
// CITATION MANAGEMENT
// ============================================

/**
 * Fetch all citations with violation details
 */
export async function getCitations(
    paidStatus?: boolean | 'all',
    limit: number = 100
): Promise<Citation[]> {
    let query = supabase
        .from('citations')
        .select(`
            *,
            violation:violations (
                id,
                junction_id,
                violation_type,
                timestamp,
                vehicle_speed,
                license_plate,
                junctions (name)
            )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (paidStatus !== undefined && paidStatus !== 'all') {
        query = query.eq('paid', paidStatus);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching citations:', error);
        return [];
    }

    return data || [];
}

/**
 * Mark a citation as paid
 */
export async function markCitationPaid(
    citationId: number,
    paymentMethod: string = 'online',
    paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('citations')
            .update({
                paid: true,
                paid_at: new Date().toISOString(),
                payment_method: paymentMethod,
                payment_reference: paymentReference || null
            })
            .eq('id', citationId);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Error marking citation paid:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to new violations in real-time
 */
export function subscribeToViolations(
    callback: (violation: AdminViolation) => void
) {
    const channel = supabase
        .channel('admin-violations')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'violations'
            },
            (payload) => {
                callback(payload.new as AdminViolation);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscribe to violation status changes
 */
export function subscribeToViolationUpdates(
    callback: (violation: AdminViolation) => void
) {
    const channel = supabase
        .channel('admin-violation-updates')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'violations'
            },
            (payload) => {
                callback(payload.new as AdminViolation);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface DashboardStats {
    totalChallans: number;
    revenueCollected: number;
    pendingAmount: number;
    activeJunctions: number;
    pendingViolations: number;
    vehiclesToday: number;
    emergencyAlerts: number;
}

export interface JunctionWithTraffic {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
    currentVehicleCount: number;
    congestionLevel: 'Low' | 'Medium' | 'High';
    recentViolations: number;
    lastUpdate: string;
}

export interface TrafficDataPoint {
    timestamp: string;
    vehicleCount: number;
}

/**
 * Fetch comprehensive dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Parallel fetch all stats
        const [
            citationsResult,
            violationsResult,
            junctionsResult,
            trafficResult,
            emergencyResult
        ] = await Promise.all([
            // Get citations stats
            supabase.from('citations').select('fine_amount, paid'),
            // Get pending violations
            supabase.from('violations').select('id, status').or('status.eq.pending,status.is.null'),
            // Get active junctions
            supabase.from('junctions').select('id, status').eq('status', 'active'),
            // Get today's traffic logs
            supabase.from('traffic_logs').select('id').gte('timestamp', today.toISOString()),
            // Get emergency alerts
            supabase.from('emergency_vehicles').select('id').eq('status', 'active')
        ]);

        const citations = citationsResult.data || [];
        const violations = violationsResult.data || [];
        const junctions = junctionsResult.data || [];
        const trafficLogs = trafficResult.data || [];
        const emergencies = emergencyResult.data || [];

        return {
            totalChallans: citations.length,
            revenueCollected: citations
                .filter(c => c.paid)
                .reduce((sum, c) => sum + (Number(c.fine_amount) || 0), 0),
            pendingAmount: citations
                .filter(c => !c.paid)
                .reduce((sum, c) => sum + (Number(c.fine_amount) || 0), 0),
            activeJunctions: junctions.length,
            pendingViolations: violations.length,
            vehiclesToday: trafficLogs.length,
            emergencyAlerts: emergencies.length
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return {
            totalChallans: 0,
            revenueCollected: 0,
            pendingAmount: 0,
            activeJunctions: 0,
            pendingViolations: 0,
            vehiclesToday: 0,
            emergencyAlerts: 0
        };
    }
}

/**
 * Fetch all junctions with their current traffic status
 */
export async function getJunctionsWithTraffic(): Promise<JunctionWithTraffic[]> {
    try {
        // Get all junctions
        const { data: junctions, error: jError } = await supabase
            .from('junctions')
            .select('*')
            .order('name');

        if (jError || !junctions) {
            console.error('Error fetching junctions:', jError);
            return [];
        }

        // Get latest traffic log for each junction
        const junctionIds = junctions.map(j => j.id);

        // Get recent traffic logs (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: trafficLogs } = await supabase
            .from('traffic_logs')
            .select('junction_id, vehicle_count, congestion_level, timestamp')
            .in('junction_id', junctionIds)
            .gte('timestamp', oneHourAgo)
            .order('timestamp', { ascending: false });

        // Get recent violations count per junction
        const { data: violations } = await supabase
            .from('violations')
            .select('junction_id')
            .in('junction_id', junctionIds)
            .or('status.eq.pending,status.is.null');

        // Map junctions with their traffic data
        return junctions.map(junction => {
            const latestLog = trafficLogs?.find(log => log.junction_id === junction.id);
            const violationCount = violations?.filter(v => v.junction_id === junction.id).length || 0;

            return {
                id: junction.id,
                name: junction.name,
                latitude: junction.latitude,
                longitude: junction.longitude,
                status: junction.status || 'offline',
                currentVehicleCount: latestLog?.vehicle_count || 0,
                congestionLevel: (latestLog?.congestion_level as 'Low' | 'Medium' | 'High') || 'Low',
                recentViolations: violationCount,
                lastUpdate: latestLog?.timestamp || junction.last_update || new Date().toISOString()
            };
        });
    } catch (error) {
        console.error('Error fetching junctions with traffic:', error);
        return [];
    }
}

/**
 * Fetch recent traffic logs for a specific junction (for the line graph)
 */
export async function getRecentTrafficLogs(
    junctionId: number,
    minutes: number = 30
): Promise<TrafficDataPoint[]> {
    try {
        const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('traffic_logs')
            .select('timestamp, vehicle_count')
            .eq('junction_id', junctionId)
            .gte('timestamp', since)
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Error fetching traffic logs:', error);
            return [];
        }

        return (data || []).map(log => ({
            timestamp: log.timestamp,
            vehicleCount: log.vehicle_count
        }));
    } catch (error) {
        console.error('Error fetching traffic logs:', error);
        return [];
    }
}

/**
 * Subscribe to real-time traffic updates for all junctions
 */
export function subscribeToTrafficUpdates(
    callback: (log: { junction_id: number; vehicle_count: number; congestion_level: string }) => void
): () => void {
    const channel = supabase
        .channel('traffic-updates')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'traffic_logs'
            },
            (payload) => {
                callback(payload.new as { junction_id: number; vehicle_count: number; congestion_level: string });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscribe to real-time junction status updates
 */
export function subscribeToJunctionUpdates(
    callback: (junction: { id: number; status: string }) => void
): () => void {
    const channel = supabase
        .channel('junction-updates')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'junctions'
            },
            (payload) => {
                callback(payload.new as { id: number; status: string });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
