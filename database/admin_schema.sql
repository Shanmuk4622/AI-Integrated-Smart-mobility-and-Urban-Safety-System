-- =====================================================
-- ADMIN PANEL DATABASE SCHEMA
-- Smart Mobility & Urban Safety System
-- =====================================================
-- This schema extends the existing database with admin-specific tables
-- Run this AFTER the main supabase_schema.sql
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. ADMIN USERS & AUTHENTICATION
-- =====================================================

-- Admin roles enum (create only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
        CREATE TYPE admin_role AS ENUM (
            'super_admin',
            'traffic_manager',
            'analyst',
            'operator',
            'auditor'
        );
    END IF;
END $$;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role admin_role NOT NULL DEFAULT 'operator',
    department TEXT,
    phone TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    
    -- Metadata
    last_login TIMESTAMPTZ,
    last_login_ip INET,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id),
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~* '^\+?[0-9]{10,15}$')
);

-- Admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    
    -- Session data
    token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES admin_users(id),
    
    -- Action details
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    changes JSONB,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Metadata
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin tables
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- =====================================================
-- 2. VIOLATION MANAGEMENT ENHANCEMENTS
-- =====================================================

-- Violation status enum (create only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'violation_status') THEN
        CREATE TYPE violation_status AS ENUM (
            'pending',
            'under_review',
            'approved',
            'rejected',
            'appealed',
            'appeal_approved',
            'appeal_rejected',
            'closed'
        );
    END IF;
END $$;

-- Update existing violations table (if it exists)
DO $$ 
BEGIN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'status') THEN
        ALTER TABLE violations ADD COLUMN status violation_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'reviewed_by') THEN
        ALTER TABLE violations ADD COLUMN reviewed_by UUID REFERENCES admin_users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'reviewed_at') THEN
        ALTER TABLE violations ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'review_notes') THEN
        ALTER TABLE violations ADD COLUMN review_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'confidence_score') THEN
        ALTER TABLE violations ADD COLUMN confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'vehicle_speed') THEN
        ALTER TABLE violations ADD COLUMN vehicle_speed FLOAT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'appeal_reason') THEN
        ALTER TABLE violations ADD COLUMN appeal_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'appeal_evidence_urls') THEN
        ALTER TABLE violations ADD COLUMN appeal_evidence_urls TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'appeal_reviewed_by') THEN
        ALTER TABLE violations ADD COLUMN appeal_reviewed_by UUID REFERENCES admin_users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'appeal_reviewed_at') THEN
        ALTER TABLE violations ADD COLUMN appeal_reviewed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Citations table
CREATE TABLE IF NOT EXISTS citations (
    id BIGSERIAL PRIMARY KEY,
    citation_number TEXT UNIQUE NOT NULL,
    violation_id BIGINT REFERENCES violations(id) ON DELETE CASCADE,
    
    -- Fine details
    fine_amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    
    -- Payment
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_reference TEXT,
    
    -- Delivery
    sent_via TEXT, -- email, mail, sms
    sent_at TIMESTAMPTZ,
    delivery_status TEXT,
    delivery_attempts INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_fine_amount CHECK (fine_amount > 0),
    CONSTRAINT valid_due_date CHECK (due_date >= CURRENT_DATE)
);

-- Indexes for violations
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_reviewed_at ON violations(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_confidence ON violations(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_citations_violation ON citations(violation_id);
CREATE INDEX IF NOT EXISTS idx_citations_due_date ON citations(due_date);
CREATE INDEX IF NOT EXISTS idx_citations_paid ON citations(paid);
CREATE INDEX IF NOT EXISTS idx_citations_citation_number ON citations(citation_number);

-- =====================================================
-- 3. ANALYTICS & REPORTING
-- =====================================================

-- Hourly traffic statistics
CREATE TABLE IF NOT EXISTS traffic_stats_hourly (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    hour_timestamp TIMESTAMPTZ NOT NULL,
    
    -- Aggregated metrics
    avg_vehicles FLOAT,
    max_vehicles INT,
    min_vehicles INT,
    total_vehicles INT,
    
    -- Congestion metrics
    congestion_minutes INT DEFAULT 0,
    avg_congestion_level TEXT,
    
    -- Data quality
    total_logs INT,
    missing_data_minutes INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(junction_id, hour_timestamp)
);

-- Daily traffic statistics
CREATE TABLE IF NOT EXISTS traffic_stats_daily (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Aggregated metrics
    total_vehicles INT,
    avg_vehicles FLOAT,
    peak_hour INT, -- 0-23
    peak_vehicles INT,
    
    -- Congestion metrics
    congestion_hours INT DEFAULT 0,
    total_congestion_minutes INT DEFAULT 0,
    
    -- Violations
    total_violations INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(junction_id, date)
);

-- Violation statistics
CREATE TABLE IF NOT EXISTS violation_stats_daily (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    violation_type TEXT NOT NULL,
    
    -- Counts
    total_count INT DEFAULT 0,
    approved_count INT DEFAULT 0,
    rejected_count INT DEFAULT 0,
    pending_count INT DEFAULT 0,
    
    -- Revenue
    total_fines DECIMAL(10,2) DEFAULT 0,
    collected_fines DECIMAL(10,2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(junction_id, date, violation_type)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_hourly_junction_time ON traffic_stats_hourly(junction_id, hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_daily_junction_date ON traffic_stats_daily(junction_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_violation_stats_date ON violation_stats_daily(date DESC);

-- =====================================================
-- 4. SYSTEM HEALTH & MONITORING
-- =====================================================

-- Worker health metrics
CREATE TABLE IF NOT EXISTS worker_health (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    
    -- Performance metrics
    fps FLOAT,
    cpu_usage FLOAT,
    memory_usage FLOAT,
    disk_usage FLOAT,
    
    -- Detection metrics
    avg_detection_confidence FLOAT,
    total_detections INT,
    
    -- Status
    status TEXT DEFAULT 'running', -- running, stopped, error
    error_message TEXT,
    
    -- Heartbeat
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System alerts
CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGSERIAL PRIMARY KEY,
    
    -- Alert details
    severity TEXT NOT NULL, -- info, warning, error, critical
    title TEXT NOT NULL,
    description TEXT,
    source TEXT, -- junction_id or system component
    
    -- Status
    status TEXT DEFAULT 'open', -- open, acknowledged, resolved, closed
    acknowledged_by UUID REFERENCES admin_users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admin_users(id),
    resolved_at TIMESTAMPTZ,
    
    -- Actions
    recommended_actions TEXT[],
    auto_remediation_attempted BOOLEAN DEFAULT false,
    
    -- Metadata
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Incident details
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, investigating, resolved, closed
    
    -- Assignment
    assigned_to UUID REFERENCES admin_users(id),
    assigned_at TIMESTAMPTZ,
    
    -- Resolution
    root_cause TEXT,
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    
    -- Impact
    affected_junctions INT[],
    estimated_data_loss_minutes INT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_incident_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_worker_health_junction ON worker_health(junction_id);
CREATE INDEX IF NOT EXISTS idx_worker_health_timestamp ON worker_health(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON system_alerts(status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, created_at DESC);

-- =====================================================
-- 5. EMERGENCY VEHICLE PRIORITY
-- =====================================================

-- Emergency vehicle detections
CREATE TABLE IF NOT EXISTS emergency_vehicles (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    
    -- Vehicle details
    vehicle_type TEXT DEFAULT 'ambulance',
    direction TEXT, -- north, south, east, west
    estimated_speed FLOAT,
    
    -- Priority
    priority_level INT DEFAULT 1, -- 1=highest
    
    -- Tracking
    detected_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- active, cleared, lost
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_direction CHECK (direction IN ('north', 'south', 'east', 'west', 'unknown'))
);

-- Priority routes (green corridors)
CREATE TABLE IF NOT EXISTS priority_routes (
    id BIGSERIAL PRIMARY KEY,
    emergency_vehicle_id BIGINT REFERENCES emergency_vehicles(id) ON DELETE CASCADE,
    
    -- Route details
    start_junction_id BIGINT REFERENCES junctions(id),
    end_junction_id BIGINT,
    route_path JSONB, -- Array of junction IDs and coordinates
    
    -- Status
    status TEXT DEFAULT 'active', -- active, completed, expired
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for emergency
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_vehicles(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_junction ON emergency_vehicles(junction_id);
CREATE INDEX IF NOT EXISTS idx_priority_routes_active ON priority_routes(status, expires_at);

-- =====================================================
-- 6. CONFIGURATION & SETTINGS
-- =====================================================

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT, -- traffic, system, notifications, integrations
    
    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

-- Insert default configurations
INSERT INTO system_config (key, value, description, category) VALUES
('congestion_thresholds', '{"low": 10, "medium": 20, "high": 30}'::jsonb, 'Vehicle count thresholds for congestion levels', 'traffic'),
('speed_limits', '{"highway": 100, "arterial": 60, "residential": 40}'::jsonb, 'Default speed limits by road type (km/h)', 'traffic'),
('data_retention_days', '{"traffic_logs": 90, "violations": 365, "audit_logs": 730}'::jsonb, 'Data retention periods', 'system'),
('notification_settings', '{"email_enabled": true, "sms_enabled": false, "slack_enabled": false}'::jsonb, 'Notification channel settings', 'notifications'),
('auto_approve_threshold', '0.95'::jsonb, 'Confidence threshold for auto-approving violations', 'traffic')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 7. REPORTS & EXPORTS
-- =====================================================

-- Scheduled reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id BIGSERIAL PRIMARY KEY,
    
    -- Report details
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL, -- daily, weekly, monthly, custom
    
    -- Configuration
    metrics TEXT[], -- traffic, violations, system_health
    date_range TEXT, -- 24h, 7d, 30d
    grouping TEXT, -- junction, time, violation_type
    
    -- Schedule
    schedule_cron TEXT, -- cron expression
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    
    -- Distribution
    recipients TEXT[],
    format TEXT DEFAULT 'pdf', -- pdf, csv, excel
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id)
);

-- Report history
CREATE TABLE IF NOT EXISTS report_history (
    id BIGSERIAL PRIMARY KEY,
    scheduled_report_id BIGINT REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    
    -- Execution details
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    file_url TEXT,
    file_size_bytes BIGINT,
    
    -- Status
    status TEXT DEFAULT 'success', -- success, failed
    error_message TEXT,
    
    -- Metadata
    execution_time_ms INT
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(scheduled_report_id, generated_at DESC);

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Admin users policies
DROP POLICY IF EXISTS admin_users_select ON admin_users;
CREATE POLICY admin_users_select ON admin_users
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM admin_users WHERE is_active = true));

DROP POLICY IF EXISTS admin_users_update ON admin_users;
CREATE POLICY admin_users_update ON admin_users
    FOR UPDATE
    USING (
        auth.uid() IN (SELECT id FROM admin_users WHERE role = 'super_admin')
        OR auth.uid() = id -- Users can update their own profile
    );

-- Violations policies
DROP POLICY IF EXISTS violations_select ON violations;
CREATE POLICY violations_select ON violations
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM admin_users 
            WHERE role IN ('super_admin', 'traffic_manager', 'operator', 'auditor')
        )
    );

DROP POLICY IF EXISTS violations_update ON violations;
CREATE POLICY violations_update ON violations
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM admin_users 
            WHERE role IN ('super_admin', 'traffic_manager', 'operator')
        )
    );

-- Audit logs policies (read-only for most, super_admin can delete)
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM admin_users 
            WHERE role IN ('super_admin', 'auditor')
        )
    );

DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- System alerts policies
DROP POLICY IF EXISTS alerts_select ON system_alerts;
CREATE POLICY alerts_select ON system_alerts
    FOR SELECT
    USING (
        auth.uid() IN (SELECT id FROM admin_users WHERE is_active = true)
    );

DROP POLICY IF EXISTS alerts_update ON system_alerts;
CREATE POLICY alerts_update ON system_alerts
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM admin_users 
            WHERE role IN ('super_admin', 'traffic_manager', 'operator')
        )
    );

-- =====================================================
-- 9. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_citations_updated_at ON citations;
CREATE TRIGGER update_citations_updated_at BEFORE UPDATE ON citations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_violations_changes ON violations;
CREATE TRIGGER audit_violations_changes AFTER INSERT OR UPDATE OR DELETE ON violations
    FOR EACH ROW EXECUTE FUNCTION log_admin_action();

DROP TRIGGER IF EXISTS audit_citations_changes ON citations;
CREATE TRIGGER audit_citations_changes AFTER INSERT OR UPDATE OR DELETE ON citations
    FOR EACH ROW EXECUTE FUNCTION log_admin_action();

-- Function to aggregate hourly traffic data
CREATE OR REPLACE FUNCTION aggregate_traffic_hourly()
RETURNS void AS $$
BEGIN
    INSERT INTO traffic_stats_hourly (
        junction_id,
        hour_timestamp,
        avg_vehicles,
        max_vehicles,
        min_vehicles,
        total_vehicles,
        congestion_minutes,
        total_logs
    )
    SELECT 
        junction_id,
        DATE_TRUNC('hour', timestamp) as hour_timestamp,
        AVG(vehicle_count)::FLOAT as avg_vehicles,
        MAX(vehicle_count) as max_vehicles,
        MIN(vehicle_count) as min_vehicles,
        SUM(vehicle_count) as total_vehicles,
        SUM(CASE WHEN congestion_level = 'High' THEN 1 ELSE 0 END) as congestion_minutes,
        COUNT(*) as total_logs
    FROM traffic_logs
    WHERE timestamp >= NOW() - INTERVAL '2 hours'
    AND timestamp < DATE_TRUNC('hour', NOW())
    GROUP BY junction_id, DATE_TRUNC('hour', timestamp)
    ON CONFLICT (junction_id, hour_timestamp) 
    DO UPDATE SET
        avg_vehicles = EXCLUDED.avg_vehicles,
        max_vehicles = EXCLUDED.max_vehicles,
        min_vehicles = EXCLUDED.min_vehicles,
        total_vehicles = EXCLUDED.total_vehicles,
        congestion_minutes = EXCLUDED.congestion_minutes,
        total_logs = EXCLUDED.total_logs;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily traffic data
CREATE OR REPLACE FUNCTION aggregate_traffic_daily()
RETURNS void AS $$
BEGIN
    INSERT INTO traffic_stats_daily (
        junction_id,
        date,
        total_vehicles,
        avg_vehicles,
        peak_hour,
        peak_vehicles,
        congestion_hours
    )
    SELECT 
        junction_id,
        DATE(hour_timestamp) as date,
        SUM(total_vehicles) as total_vehicles,
        AVG(avg_vehicles)::FLOAT as avg_vehicles,
        (ARRAY_AGG(EXTRACT(HOUR FROM hour_timestamp) ORDER BY max_vehicles DESC))[1]::INT as peak_hour,
        MAX(max_vehicles) as peak_vehicles,
        SUM(CASE WHEN congestion_minutes > 30 THEN 1 ELSE 0 END) as congestion_hours
    FROM traffic_stats_hourly
    WHERE hour_timestamp >= CURRENT_DATE - INTERVAL '2 days'
    AND hour_timestamp < CURRENT_DATE
    GROUP BY junction_id, DATE(hour_timestamp)
    ON CONFLICT (junction_id, date) 
    DO UPDATE SET
        total_vehicles = EXCLUDED.total_vehicles,
        avg_vehicles = EXCLUDED.avg_vehicles,
        peak_hour = EXCLUDED.peak_hour,
        peak_vehicles = EXCLUDED.peak_vehicles,
        congestion_hours = EXCLUDED.congestion_hours;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for violation summary
CREATE OR REPLACE VIEW violation_summary AS
SELECT 
    v.id,
    v.junction_id,
    j.name as junction_name,
    v.violation_type,
    v.timestamp as detected_at,
    v.status,
    v.confidence_score,
    v.reviewed_by,
    v.reviewed_at,
    c.citation_number,
    c.fine_amount,
    c.paid
FROM violations v
LEFT JOIN junctions j ON v.junction_id = j.id
LEFT JOIN citations c ON v.id = c.violation_id;

-- View for junction health summary
CREATE OR REPLACE VIEW junction_health_summary AS
SELECT 
    j.id,
    j.name,
    j.status,
    wh.fps,
    wh.cpu_usage,
    wh.memory_usage,
    wh.last_heartbeat,
    CASE 
        WHEN wh.last_heartbeat > NOW() - INTERVAL '5 minutes' THEN 'online'
        WHEN wh.last_heartbeat > NOW() - INTERVAL '15 minutes' THEN 'warning'
        ELSE 'offline'
    END as health_status
FROM junctions j
LEFT JOIN LATERAL (
    SELECT * FROM worker_health 
    WHERE junction_id = j.id 
    ORDER BY created_at DESC 
    LIMIT 1
) wh ON true;

-- =====================================================
-- 11. INITIAL DATA
-- =====================================================

-- Create default super admin (password should be changed immediately)
INSERT INTO admin_users (email, full_name, role, department)
VALUES ('admin@smartmobility.local', 'System Administrator', 'super_admin', 'IT')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Admin panel database schema created successfully!';
    RAISE NOTICE '📊 Total tables created: 20+';
    RAISE NOTICE '🔐 RLS policies enabled';
    RAISE NOTICE '⚡ Functions and triggers configured';
    RAISE NOTICE '👤 Default admin user created: admin@smartmobility.local';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Change the default admin password immediately!';
END $$;

-- =====================================================
-- ADDITIONAL COLUMNS (Added for worker integration)
-- =====================================================

-- Add license_plate column to violations if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'violations' AND column_name = 'license_plate') THEN
        ALTER TABLE violations ADD COLUMN license_plate TEXT;
    END IF;
END $$;

-- Add Worker Configuration Columns to Junctions Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'junctions' AND column_name = 'ppm') THEN
        ALTER TABLE junctions ADD COLUMN ppm INT DEFAULT 50; -- Pixels Per Meter
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'junctions' AND column_name = 'fps') THEN
        ALTER TABLE junctions ADD COLUMN fps INT DEFAULT 30; -- Speed Calculation FPS
    END IF;
END $$;

-- Optional: Add comments
COMMENT ON COLUMN junctions.ppm IS 'Calibration: Pixels per meter for speed estimation';
COMMENT ON COLUMN junctions.fps IS 'Calibration: Assumed FPS of input video';
