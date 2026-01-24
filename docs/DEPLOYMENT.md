# Deploying to Vercel

## Architecture Overview

This project has **two separate components**:

1. **Frontend (React + Vite)** - Can be deployed to Vercel ✅
2. **Worker (Python)** - Runs separately on your local machine or server ⚠️

**Important**: Vercel will only host the frontend. The Python worker must run separately where you have access to video sources and GPU.

---

## Quick Deployment Steps

### 1. Deploy Frontend to Vercel

The `vercel.json` configuration is already set up in the project root.

**Option A: Deploy via Vercel Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the configuration
5. Click "Deploy"

**Option B: Deploy via Git Push**
```bash
git add .
git commit -m "Add Vercel configuration"
git push
```

Vercel will automatically deploy when you push to your main branch.

### 2. Configure Environment Variables in Vercel

Go to your Vercel project settings and add these environment variables:

| Variable Name | Value | Where to Find |
|---------------|-------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key | Supabase Dashboard → Settings → API |

**Steps:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add both variables for all environments (Production, Preview, Development)
3. Redeploy the project (Deployments tab → Redeploy)

### 3. Update Supabase CORS Settings

Add your Vercel domain to Supabase allowed origins:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel URL: `https://your-project.vercel.app`

---

## Current Build Configuration

The `vercel.json` file configures Vercel to:
- Build from the `frontend` directory
- Use Vite framework
- Output to `frontend/dist`
- Handle client-side routing with rewrites

---

## Running the Complete System

### Frontend (Vercel - Public Access)
- **URL**: `https://your-project.vercel.app`
- **Features**: Admin Dashboard, Route Planner, User View
- **Data Source**: Supabase (real-time updates)

### Worker (Local/Server - Private)
- **Location**: Your machine or dedicated server
- **Purpose**: Process video, detect vehicles/violations
- **Requirements**: GPU, Python, video files
- **Command**: `.\run_worker.bat`

**Data Flow:**
```
Video → Worker (Python) → Supabase → Frontend (Vercel) → Users
```

---

## Important Notes

### ⚠️ Python Worker Cannot Run on Vercel

Vercel is designed for serverless functions and static sites. The Python worker:
- Requires continuous video processing
- Needs GPU acceleration
- Uses OpenCV and YOLO models
- Must run 24/7

**Solutions:**
1. **Local Development**: Run worker on your development machine
2. **Dedicated Server**: Deploy worker to a cloud VM (AWS EC2, Google Cloud, Azure)
3. **Raspberry Pi**: Run worker on edge devices at actual junctions

### ✅ What Works on Vercel

- React frontend (Admin Dashboard, Route Planner, User View)
- Real-time data display from Supabase
- Map visualization
- Intelligent routing
- All UI components

### ❌ What Doesn't Work on Vercel

- Python worker
- Video processing
- YOLO model inference
- License plate recognition
- Violation detection

---

## Deployment Checklist

- [x] Created `vercel.json` configuration
- [x] Added environment validation
- [ ] Push to GitHub
- [ ] Connect GitHub repo to Vercel (or use Vercel CLI)
- [ ] Add environment variables in Vercel dashboard
- [ ] Deploy and test frontend
- [ ] Update Supabase CORS settings
- [ ] Run worker separately on local machine/server
- [ ] Verify real-time data flow

---

## Troubleshooting

### Build Fails with "Cannot find module"

**Solution**: Ensure `vercel.json` has correct paths:
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist"
}
```

### Frontend Shows "Supabase Connection Error"

**Solution**: Check environment variables in Vercel settings. They must start with `VITE_` prefix.

### Map Not Loading

**Solution**: 
1. Check browser console for errors
2. Verify Supabase URL and key are correct
3. Ensure CORS is configured in Supabase

### No Real-Time Updates

**Solution**:
1. Ensure worker is running: `.\run_worker.bat`
2. Check Supabase realtime is enabled
3. Verify worker is syncing data (check console output)

---

## Alternative Deployment Options

### Frontend Alternatives
- **Netlify**: Similar to Vercel, supports Vite
- **GitHub Pages**: Free static hosting
- **Firebase Hosting**: Google's hosting solution

### Worker Deployment
- **AWS EC2**: Full VM with GPU support
- **Google Cloud Compute Engine**: Scalable VMs
- **Azure VM**: Windows/Linux VMs
- **Local Server**: Dedicated machine at junction location

---

## Next Steps

1. ✅ Deploy frontend to Vercel
2. ⚙️ Set up worker on a server/local machine
3. 🔗 Connect both via Supabase
4. 📊 Monitor real-time data flow
5. 🚀 Scale by adding more junctions

Your frontend is now live on Vercel, and users can access the dashboards from anywhere!
