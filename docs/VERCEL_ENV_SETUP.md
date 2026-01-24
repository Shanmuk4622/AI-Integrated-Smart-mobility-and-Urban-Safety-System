# Adding Environment Variables to Vercel

## Quick Guide

After deploying to Vercel, you need to manually add environment variables in the Vercel dashboard.

### Step-by-Step Instructions:

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click on "Settings" tab
   - Click on "Environment Variables" in the sidebar

2. **Add These Variables:**

   **Variable 1:**
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: `https://myrswifvrszhtudxjlwx.supabase.co`
   - **Environment**: Production, Preview, Development (select all)

   **Variable 2:**
   - **Name**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cnN3aWZ2cnN6aHR1ZHhqbHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDkwOTIsImV4cCI6MjA4NDMyNTA5Mn0.YIyvUWLyUS9VD21cxdRfsuSlIcdFx3eFY-wH6wyxeDs`
   - **Environment**: Production, Preview, Development (select all)

3. **Redeploy**
   - After adding variables, go to "Deployments" tab
   - Click the three dots (...) on the latest deployment
   - Click "Redeploy"

---

## Important Notes

- ✅ Environment variables starting with `VITE_` are exposed to the browser
- ✅ The `SUPABASE_ANON_KEY` is safe to expose (it's public by design)
- ⚠️ Never expose your Supabase `SERVICE_ROLE_KEY` to the frontend

---

## Verification

After redeployment, your frontend should:
- ✅ Connect to Supabase
- ✅ Display real-time data from the worker
- ✅ Show junction locations on the map
- ✅ Update traffic statistics live

If you see connection errors, check the browser console and verify the environment variables are set correctly.
