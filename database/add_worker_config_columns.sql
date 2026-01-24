-- Add Worker Configuration Columns to Junctions Table

ALTER TABLE junctions 
ADD COLUMN IF NOT EXISTS ppm int DEFAULT 50, -- Pixels Per Meter
ADD COLUMN IF NOT EXISTS fps int DEFAULT 30; -- Speed Calculation FPS

-- Optional: Add comments
COMMENT ON COLUMN junctions.ppm IS 'Calibration: Pixels per meter for speed estimation';
COMMENT ON COLUMN junctions.fps IS 'Calibration: Assumed FPS of input video';
