# Developer Setup Guide

## 🚀 Quick Start

This guide will help you set up the Smart Mobility system for local development.

---

## Prerequisites

### Required Software
- **Python 3.9+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Supabase Account** ([Sign up](https://supabase.com/))

### Optional (Recommended)
- **NVIDIA GPU** with CUDA support for faster AI inference
- **Visual Studio Code** with Python and TypeScript extensions

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Radiothon
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install worker dependencies
pip install -r worker\requirements.txt
```

### 3. Set Up Frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configure Environment Variables

Create a `.env` file in the **project root**:

```ini
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

Create a `.env` file in the **frontend** directory:

```ini
# Frontend Environment (must start with VITE_)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Where to find these values:**
> 1. Go to [Supabase Dashboard](https://app.supabase.com/)
> 2. Select your project
> 3. Go to Settings → API
> 4. Copy the URL and `anon/public` key

### 5. Set Up Database

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Run the contents of `supabase_schema.sql`

This will create:
- `junctions` table
- `traffic_logs` table
- `violations` table
- Row Level Security policies

### 6. Download AI Models

You need two YOLO models:

1. **YOLOv8 COCO Model** (`yolov8n.pt`)
   - Download from: [Ultralytics](https://github.com/ultralytics/ultralytics)
   - Place in: `worker/assets/yolov8n.pt`

2. **License Plate Detector** (`license_plate_detector.pt`)
   - Custom trained model (optional)
   - Place in: `worker/assets/license_plate_detector.pt`

### 7. Add Sample Video

Place a sample traffic video in:
```
worker/Videos/sample.mp4
```

Or update `worker/config.py` to point to your video source.

---

## 🏃 Running the System

### Option 1: Run Everything (Recommended for Development)

```bash
# Terminal 1: Start Worker
.\run_worker.bat

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

### Option 2: Run Components Separately

**Worker Only:**
```bash
python worker\main.py
```

**Frontend Only:**
```bash
cd frontend
npm run dev
```

**With Custom Configuration:**
```bash
# Run worker for Junction 2 with debug logging
python worker\main.py --junction_id 2 --log_level DEBUG

# Run headless (no GUI)
python worker\main.py --no-gui

# Save processed video
python worker\main.py --save
```

---

## 🔧 Configuration

### Worker Configuration (`worker/config.py`)

```python
# Junction Identity
JUNCTION_ID = 1
LOCATION_NAME = "Main Street & 5th Ave"

# GPS Coordinates
LATITUDE = 40.7128
LONGITUDE = -74.0060

# Video Source (file or RTSP stream)
VIDEO_SOURCE = "Videos/sample.mp4"
# VIDEO_SOURCE = "rtsp://username:password@ip:port/stream"

# Display Options
SHOW_GUI = True  # Set False for headless servers
SAVE_VIDEO = False  # Set True to save processed output

# Processing
LOG_INTERVAL = 5.0  # Seconds between database syncs
CONFIDENCE_THRESHOLD = 0.5
```

### Frontend Configuration

Environment variables in `frontend/.env`:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

---

## 🧪 Testing Your Setup

### 1. Test Database Connection

```bash
python test_db_update.py
```

Expected output: "✅ Successfully logged test data"

### 2. Test Worker Startup

```bash
python worker\main.py --log_level DEBUG
```

Check for:
- ✅ Configuration validation passed
- ✅ Supabase Client Initialized
- ✅ Models loaded successfully
- ✅ Video capture started

### 3. Test Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` and verify:
- ✅ Map loads with junction markers
- ✅ No console errors
- ✅ Real-time data updates when worker is running

---

## 📁 Project Structure

```
Radiothon/
├── worker/                 # Python AI worker
│   ├── assets/            # YOLO models
│   ├── core/              # AI pipeline (processor.py)
│   ├── services/          # Supabase client
│   ├── utils/             # Logging, validation, error handling
│   ├── config.py          # Worker configuration
│   └── main.py            # Entry point
├── frontend/              # React dashboard
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Supabase client, utilities
│   │   └── types/         # TypeScript types
│   └── package.json
├── backend/               # Legacy FastAPI (deprecated)
├── scripts/               # Utility scripts
├── supabase_schema.sql    # Database schema
├── run_worker.bat         # Worker launcher
└── .env                   # Environment variables
```

---

## 🐛 Troubleshooting

### Worker Issues

**"Video file not found"**
- Check `VIDEO_SOURCE` path in `worker/config.py`
- Ensure video file exists in `worker/Videos/`

**"COCO Model not found"**
- Download `yolov8n.pt` and place in `worker/assets/`

**"CUDA out of memory"**
- Reduce video resolution
- Use CPU instead: Set `device='cpu'` in processor.py

**"Supabase connection error"**
- Verify `.env` file exists in project root
- Check `SUPABASE_URL` and `SUPABASE_KEY` are correct

### Frontend Issues

**"Environment validation failed"**
- Check `frontend/.env` exists
- Ensure variables start with `VITE_` prefix

**"Map not loading"**
- Check browser console for errors
- Verify Supabase credentials
- Ensure database tables exist

**"No real-time updates"**
- Ensure worker is running
- Check Supabase Realtime is enabled in dashboard
- Verify RLS policies allow public access

---

## 🚀 Next Steps

1. **Customize Junction**: Edit `worker/config.py` with your location
2. **Add More Junctions**: Copy `run_worker.bat` and modify junction ID
3. **Deploy Frontend**: See `DEPLOYMENT.md` for Vercel deployment
4. **Add Features**: Check `implementation_plan.md` for improvement ideas

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [YOLOv8 Documentation](https://docs.ultralytics.com/)
- [React Leaflet](https://react-leaflet.js.org/)
- [Vite Documentation](https://vitejs.dev/)

---

## 🤝 Getting Help

If you encounter issues:
1. Check the `logs/` directory for detailed error messages
2. Review the troubleshooting section above
3. Check existing GitHub issues
4. Create a new issue with logs and error details
