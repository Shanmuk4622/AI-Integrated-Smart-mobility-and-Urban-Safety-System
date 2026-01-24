-- =====================================================
-- GRANT ADMIN ACCESS
-- Run this to allow a user to login to the Admin Panel
-- =====================================================

-- 1. Replace 'your-email@example.com' with your Supabase Login Email
-- 2. Run this script in Supabase SQL Editor

INSERT INTO admin_users (email, full_name, role, department)
VALUES (
    'your-email@example.com',  -- <--- CHANGE THIS
    'Super Admin',
    'super_admin',
    'IT'
)
ON CONFLICT (email) 
DO UPDATE SET 
    role = 'super_admin', 
    is_active = true;

-- Verification
SELECT * FROM admin_users WHERE email = 'your-email@example.com';
