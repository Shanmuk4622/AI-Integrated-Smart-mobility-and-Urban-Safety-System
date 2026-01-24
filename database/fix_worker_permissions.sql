-- =====================================================
-- FIX WORKER PERMISSIONS (RLS)
-- Run this if you see "new row violates row-level security policy"
-- This allows the worker (running with ANON key) to insert data
-- =====================================================

-- 1. Emergency Vehicles: Allow Anon Insert
DROP POLICY IF EXISTS "Worker Insert Emergency" ON emergency_vehicles;
CREATE POLICY "Worker Anon Insert Emergency" ON emergency_vehicles 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

-- Allow updates too (for last_seen_at)
DROP POLICY IF EXISTS "Worker Update Emergency" ON emergency_vehicles;
CREATE POLICY "Worker Anon Update Emergency" ON emergency_vehicles 
FOR UPDATE TO anon, authenticated 
USING (true);

-- 2. Worker Health: Allow Anon Insert
DROP POLICY IF EXISTS "Worker Insert Health" ON worker_health;
CREATE POLICY "Worker Anon Insert Health" ON worker_health 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

-- 3. Violations: Allow Anon Insert
-- Check if policy exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'violations' AND policyname = 'Worker Anon Insert Violations'
    ) THEN
        CREATE POLICY "Worker Anon Insert Violations" ON violations 
        FOR INSERT TO anon, authenticated 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Traffic Logs: Ensure Anon Insert (just in case)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'traffic_logs' AND policyname = 'Worker Anon Insert Traffic'
    ) THEN
        CREATE POLICY "Worker Anon Insert Traffic" ON traffic_logs 
        FOR INSERT TO anon, authenticated 
        WITH CHECK (true);
    END IF;
END $$;

-- 5. Storage: Allow Anon Uploads for Violations
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Worker Anon Upload" ON storage.objects 
FOR INSERT TO anon, authenticated 
WITH CHECK (bucket_id = 'violations');

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Worker permissions fixed! RLS policies now allow anon inserts.';
END $$;
