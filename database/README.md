# 🗄️ Database Schemas & Scripts

This directory contains all SQL scripts for setting up the Supabase backend.

## 🚀 Setup Order

1.  **`admin_schema.sql`**
    *   **Purpose:** The MAIN schema. Creates `admin_users`, `junctions`, `violations`, `citations`, and `traffic_logs` tables.
    *   **Action:** Run this FIRST to initialize your database.

2.  **`fix_admin_rls.sql`**
    *   **Purpose:** Fixes Row Level Security (RLS) for the Admin Panel login.
    *   **Action:** Run this if you see "Access Denied" errors during login.

3.  **`add_admin_user.sql`**
    *   **Purpose:** Helper script to grant Admin access to a specific email address.
    *   **Action:** Edit the email inside and run this to create your login credentials.

## 📂 Other Files
-   `supabase_realtime_setup.sql`: Older script for enabling realtime (merged into schema mostly).
-   `worker_enhancement.sql`: Updates for worker capabilities (applied).
