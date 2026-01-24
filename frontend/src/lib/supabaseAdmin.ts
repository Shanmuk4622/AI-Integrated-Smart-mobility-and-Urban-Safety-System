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
