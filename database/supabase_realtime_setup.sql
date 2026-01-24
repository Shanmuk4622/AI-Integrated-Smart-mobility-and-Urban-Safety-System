-- ============================================
-- SUPABASE REALTIME SETUP FOR SMART MOBILITY
-- ============================================
-- Run these queries in Supabase SQL Editor

-- 1. Check if Realtime is currently enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE tablename IN ('traffic_logs', 'junctions', 'violations');

-- Expected: Should show these tables if enabled
-- If empty, realtime is NOT enabled


-- 2. Enable Realtime for traffic_logs (REQUIRED for rerouting)
ALTER PUBLICATION supabase_realtime ADD TABLE traffic_logs;

-- 3. Enable Realtime for junctions (for status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE junctions;

-- 4. Enable Realtime for violations (optional, for live violation feed)
ALTER PUBLICATION supabase_realtime ADD TABLE violations;


-- 5. Verify Realtime is now enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE tablename IN ('traffic_logs', 'junctions', 'violations');

-- Expected output:
-- schemaname | tablename
-- -----------+--------------
-- public     | traffic_logs
-- public     | junctions
-- public     | violations


-- ============================================
-- TESTING QUERIES
-- ============================================

-- Test 1: Check recent traffic data
SELECT 
    tl.id,
    tl.junction_id,
    j.name as junction_name,
    tl.vehicle_count,
    tl.congestion_level,
    tl.timestamp
FROM traffic_logs tl
JOIN junctions j ON j.id = tl.junction_id
ORDER BY tl.timestamp DESC
LIMIT 10;


-- Test 2: Manually insert test data (to trigger frontend update)
INSERT INTO traffic_logs (junction_id, vehicle_count, congestion_level, avg_speed)
VALUES (3, 50, 'High', 0.0);

-- After running this, your frontend should immediately show:
-- 📊 Real-time traffic update: { junction: 3, vehicles: 50, congestion: 'High' }


-- Test 3: Clean up old data (optional - keeps last hour only)
DELETE FROM traffic_logs 
WHERE timestamp < NOW() - INTERVAL '1 hour';


-- Test 4: Check junction status
SELECT id, name, status, latitude, longitude 
FROM junctions 
ORDER BY id;


-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If you get "permission denied" error:
-- Make sure you're using the service_role key or have proper permissions

-- If tables don't exist, create them:
-- (This should already be done, but just in case)

CREATE TABLE IF NOT EXISTS junctions (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude FLOAT8 NOT NULL,
    longitude FLOAT8 NOT NULL,
    status TEXT DEFAULT 'offline',
    video_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traffic_logs (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id),
    vehicle_count INT NOT NULL,
    congestion_level TEXT NOT NULL,
    avg_speed FLOAT8 DEFAULT 0.0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violations (
    id BIGSERIAL PRIMARY KEY,
    junction_id BIGINT REFERENCES junctions(id),
    violation_type TEXT NOT NULL,
    image_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
