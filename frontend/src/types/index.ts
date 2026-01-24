// ===================================
// Database Types
// ===================================

export interface Junction {
    id: number;
    name: string;
    location?: string; // Legacy field (deprecated)
    latitude: number;
    longitude: number;
    video_source: string;
    status: 'active' | 'offline' | 'maintenance';
    created_at?: string;
}

export interface TrafficLog {
    id?: number;
    junction_id: number;
    vehicle_count: number;
    congestion_level: 'Low' | 'Medium' | 'High';
    avg_speed: number;
    timestamp?: string;
}

export interface Violation {
    id: number;
    junction_id: number;
    violation_type: 'Wrong Way' | 'Red Light' | 'Speeding' | 'No Helmet';
    image_url?: string;
    timestamp: string;
}

// ===================================
// Real-time Data Types
// ===================================

export interface SignalStatus {
    action: "GREEN" | "RED";
    duration: number;
    reason: string;
}

export interface StreamStats {
    density: number;
    signal: SignalStatus;
    ambulance: boolean;
}

// ===================================
// Route Planning Types
// ===================================

export interface RouteSegment {
    start: [number, number]; // [lat, lng]
    end: [number, number];
    distance: number; // meters
    duration: number; // seconds
    congestion_factor: number; // 0-1
}

export interface RouteResult {
    segments: RouteSegment[];
    total_distance: number;
    total_duration: number;
    congestion_score: number;
    recommended: boolean;
}

export interface JunctionWithCongestion extends Junction {
    congestion_level?: 'Low' | 'Medium' | 'High';
    vehicle_count?: number;
    last_updated?: string;
}

// ===================================
// Worker Health Types
// ===================================

export interface WorkerHealth {
    junction_id: number;
    status: 'online' | 'offline' | 'degraded';
    fps: number;
    last_heartbeat: string;
    error_count: number;
    gpu_available: boolean;
    uptime_seconds: number;
}

// ===================================
// UI State Types
// ===================================

export interface LoadingState {
    isLoading: boolean;
    error: string | null;
}

export interface PaginationState {
    page: number;
    pageSize: number;
    total: number;
}

// ===================================
// API Response Types
// ===================================

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    success: boolean;
}

export interface SupabaseRealtimePayload<T> {
    new: T;
    old: T | null;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// ===================================
// Admin Panel Types
// ===================================

export type ViolationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'appealed';

export interface AdminViolation {
    id: number;
    junction_id: number;
    violation_type: 'Wrong Way' | 'Red Light' | 'Speeding' | 'No Helmet';
    image_url?: string;
    timestamp: string;
    status: ViolationStatus;
    confidence_score?: number;
    vehicle_speed?: number;
    license_plate?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    // Joined data
    junctions?: {
        name: string;
        latitude: number;
        longitude: number;
    };
}

export interface Citation {
    id: number;
    citation_number: string;
    violation_id: number;
    fine_amount: number;
    due_date: string;
    paid: boolean;
    paid_at?: string;
    payment_method?: string;
    payment_reference?: string;
    sent_via?: string;
    sent_at?: string;
    created_at: string;
    created_by?: string;
    violation?: AdminViolation;
}

export interface ViolationStats {
    total_pending: number;
    total_approved: number;
    total_rejected: number;
    approved_today: number;
    rejected_today: number;
    total_citations: number;
    revenue_collected: number;
}

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: 'super_admin' | 'traffic_manager' | 'operator' | 'auditor' | 'analyst';
    department?: string;
    phone?: string;
    is_active: boolean;
    last_login?: string;
    created_at: string;
}

