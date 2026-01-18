-- Run this in your Supabase SQL Editor

-- 1. Add new columns (idempotent - safe to run multiple times)
ALTER TABLE junctions ADD COLUMN IF NOT EXISTS latitude float;
ALTER TABLE junctions ADD COLUMN IF NOT EXISTS longitude float;

-- 2. Migrate existing data (Optional: parses the old string)
UPDATE junctions
SET 
  latitude = CAST(SPLIT_PART(location, ',', 1) AS float),
  longitude = CAST(SPLIT_PART(location, ',', 2) AS float)
WHERE location IS NOT NULL AND location LIKE '%,%';

-- 3. (Optional) Remove old column
-- ALTER TABLE junctions DROP COLUMN location;
