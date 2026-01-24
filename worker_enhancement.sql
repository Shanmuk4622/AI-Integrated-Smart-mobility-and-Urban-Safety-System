-- =====================================================
-- WORKER ENHANCEMENT SCHEMA UPDATES
-- Run this to support enhanced worker data collection
-- =====================================================

-- 1. Add missing columns to violations table
ALTER TABLE violations 
ADD COLUMN IF NOT EXISTS confidence_score FLOAT,
ADD COLUMN IF NOT EXISTS vehicle_speed FLOAT;

-- 2. Create storage bucket for violation images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('violations', 'violations', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set storage policies for public access (read) and authenticated upload (worker)
-- Note: These might fail if policies already exist, which is fine

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;

-- Re-create policies
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'violations');

CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'violations' AND auth.role() = 'authenticated');

-- 4. Create worker_health table if not exists (already in admin_schema.sql but good to be safe)
CREATE TABLE IF NOT EXISTS worker_health (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    fps FLOAT,
    cpu_usage FLOAT,
    memory_usage FLOAT,
    avg_detection_confidence FLOAT,
    total_detections INT,
    status TEXT DEFAULT 'running',
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create emergency_vehicles table if not exists
CREATE TABLE IF NOT EXISTS emergency_vehicles (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id) ON DELETE CASCADE,
    vehicle_type TEXT DEFAULT 'ambulance',
    direction TEXT,
    estimated_speed FLOAT,
    priority_level INT DEFAULT 1,
    detected_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE worker_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_vehicles ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (worker)
CREATE POLICY "Worker Insert Health" ON worker_health FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Worker Select Health" ON worker_health FOR SELECT USING (true);

CREATE POLICY "Worker Insert Emergency" ON emergency_vehicles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Worker Update Emergency" ON emergency_vehicles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Worker Select Emergency" ON emergency_vehicles FOR SELECT USING (true);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Worker enhancement schema updates applied successfully!';
END $$;
