-- =====================================================
-- FIX ADMIN PANEL RLS POLICIES
-- Smart Mobility & Urban Safety System
-- =====================================================
-- Run this to ensure admin panel can update violations and manage citations
-- =====================================================

-- Allow public updates on violations (for approve/reject)
DO $$
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'violations' 
        AND policyname = 'Allow public updates on violations'
    ) THEN
        CREATE POLICY "Allow public updates on violations" 
        ON violations FOR UPDATE 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- Enable RLS on citations if not already enabled
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- Citations policies
DO $$
BEGIN
    -- SELECT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'citations' 
        AND policyname = 'Public citations are viewable'
    ) THEN
        CREATE POLICY "Public citations are viewable" 
        ON citations FOR SELECT 
        USING (true);
    END IF;
    
    -- INSERT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'citations' 
        AND policyname = 'Allow inserts on citations'
    ) THEN
        CREATE POLICY "Allow inserts on citations" 
        ON citations FOR INSERT 
        WITH CHECK (true);
    END IF;
    
    -- UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'citations' 
        AND policyname = 'Allow updates on citations'
    ) THEN
        CREATE POLICY "Allow updates on citations" 
        ON citations FOR UPDATE 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- Admin users policies (for Settings page)
DO $$
BEGIN
    -- Allow SELECT for all authenticated users to see admin list
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_users' 
        AND policyname = 'Admin users viewable by authenticated'
    ) THEN
        CREATE POLICY "Admin users viewable by authenticated" 
        ON admin_users FOR SELECT 
        USING (true);
    END IF;
    
    -- Allow INSERT for adding new admin users
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_users' 
        AND policyname = 'Allow admin user inserts'
    ) THEN
        CREATE POLICY "Allow admin user inserts" 
        ON admin_users FOR INSERT 
        WITH CHECK (true);
    END IF;
    
    -- Allow UPDATE for modifying admin users
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_users' 
        AND policyname = 'Allow admin user updates'
    ) THEN
        CREATE POLICY "Allow admin user updates" 
        ON admin_users FOR UPDATE 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- System config policies (for Settings page)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_config' 
        AND policyname = 'System config viewable by all'
    ) THEN
        CREATE POLICY "System config viewable by all" 
        ON system_config FOR SELECT 
        USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_config' 
        AND policyname = 'Allow system config upserts'
    ) THEN
        CREATE POLICY "Allow system config upserts" 
        ON system_config FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON citations TO anon;
GRANT SELECT, INSERT, UPDATE ON citations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON admin_users TO anon;
GRANT SELECT, INSERT, UPDATE ON admin_users TO authenticated;
GRANT ALL ON system_config TO anon;
GRANT ALL ON system_config TO authenticated;

-- Ensure sequences are accessible
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
