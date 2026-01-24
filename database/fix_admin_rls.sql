-- =====================================================
-- FIX ADMIN LOGIN PERMISSIONS (FINAL)
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Drop conflicting policies to remove any infinite loops
DROP POLICY IF EXISTS admin_users_select ON admin_users;
DROP POLICY IF EXISTS admin_users_super_admin_read_all ON admin_users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON admin_users;

-- 2. Create SIMPLE (Non-Recursive) Policy
-- This allows you to read a row ONLY if the email matches your login email
CREATE POLICY admin_users_read_self ON admin_users
    FOR SELECT
    TO authenticated
    USING (
        email = (auth.jwt() ->> 'email')
    );

-- Verification
SELECT * FROM pg_policies WHERE tablename = 'admin_users';
