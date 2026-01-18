# Traffic Monitoring Worker

This is a standalone AI service designed to process video feeds from traffic junctions. It detects vehicles, calculates real-time traffic density, controls signals logic, and logs data to Supabase.

## 🚀 Features
- **Independent Service**: Can be deployed on any machine with a GPU/CPU.
- **AI Processing**: Uses YOLOv8 for vehicle detection and Custom YOLO for License Plate recognition.
- **Real-time Tracking**: Implements SORT (Simple Online and Realtime Tracking) algorithm.
- **Cloud Integration**: Syncs traffic density, violations, and signal status to Supabase.

## 📂 Directory Structure
```
worker/
├── assets/         # AI Models (yolov8n.pt, license_plate_detector.pt)
├── core/           # Core Logic (processor.py, traffic_rules.py)
├── services/       # Database & Cloud Services
├── sort/           # Tracking Algorithm
├── Videos/         # Sample footage for testing
├── main.py         # Entry point script
└── requirements.txt # Dependencies
```

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.8+
- CUDA-enabled GPU (Recommended for performance)

### 1. Install Dependencies
Run the included batch file in the root directory, or manually install:
```bash
pip install -r requirements.txt
```

### 2. Configuration
Ensure a `.env` file exists in the `worker` directory (or is copied from root) with:
```ini
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

## ▶️ How to Run

### Method 1: Automatic (Recommended)
Use the batch script located in the project root:
```cmd
.\run_worker.bat
```
This script handles virtual environment activation and dependency checking automatically.

### Method 2: Manual
```bash
# Activate your virtual environment first
python worker/main.py --junction_id 1 --source "worker/Videos/sample2.mp4"
```
**Arguments:**
- `--junction_id`: ID of the junction to monitor (Default: 1).
- `--source`: Path to video file or RTSP stream URL.
- `--coco_model`: Path to vehicle detection model.
- `--lp_model`: Path to license plate model.

## ⚠️ Troubleshooting
- **RLS Policy Error**: If you see `new row violates row-level security policy`, you need to enable "INSERT" permissions for the `anon` role in your Supabase Dashboard for the `traffic_logs` and `violations` tables.
