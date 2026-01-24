# Worker Service (Edge Node) - Deep Dive

## 🧠 How It Works
The Worker Node is an independent AI agent designed to monitor a single traffic junction. It operates in a continuous loop, transforming raw video pixels into actionable traffic data.

### 1. Object Detection (YOLOv8)
**File**: `core/processor.py`
Every frame is passed through the **YOLOv8 Nano (yolov8n.pt)** neural network.
- **Goal**: Identify objects and classify them (Car, Bus, Truck, Motorcycle).
- **Optimization**: Uses GPU (CUDA) if available, otherwise falls back to CPU.

### 2. Multi-Object Tracking (SORT)
**File**: `sort/sort.py`
Raw detections are stateless (frame-by-frame). To understand flow, we need to know if the car in Frame 1 is the same as the car in Frame 2.
- **Algorithm**: **SORT (Simple Online and Realtime Tracking)**.
- **Logic**: It uses Kalman Filters to predict where a car *should* be in the next frame. If a detection matches that prediction (IoU), it is assigned the same **Unique ID (Track ID)**.
- **Benefit**: Allows us to count unique vehicles and calculate lane density over time.

### 3. Violation Logic & Rules
**File**: `core/processor.py` & `core/traffic_rules.py`
Once we have tracks, we apply spatial rules:
- **Wrong Way**: We track the vector of movement. If a vehicle moves *against* the flow, it triggers a violation.
- **Ambulance Detection**: A secondary check analyzes the color spectrum of large vehicles (Red/Orange) to flag Ambulances.
- **Speed Estimation**: Using pixels-per-meter calibration to estimate vehicle velocity.
- **Plate Recognition**: **EasyOCR** reads text from bounding boxes on demand.

### 4. Cloud Synchronization (Supabase)
**File**: `services/supabase_client.py`
- **Startup**: Registers/Updates its Identity (ID, Status, FPS, PPM) in the `junctions` table.
- **Heartbeat**: Pushes `worker_health` (FPS, CPU, Detections) every 30s.
- **Real-Time**: 
    - **Traffic Logs**: Pushes density stats every 5s to `traffic_logs`.
    - **Violations**: Pushes events + images *immediately* to `violations`.

---

## ⚙️ Configuration (The "Control Panel")

**Everything** is controlled via **`worker/config.py`**. You do not need to edit code.

| Setting | Description |
| :--- | :--- |
| `JUNCTION_ID` | **Unique Integer**. Change this (4, 5, 6...) to create a new junction. |
| `LOCATION_NAME` | Text name (e.g., "Main St") shown on the Admin Dashboard. |
| `LATITUDE/LONGITUDE` | GPS Coordinates. The Map marker moves here automatically. |
| `VIDEO_SOURCE` | Path to `.mp4` file or **RTSP URL** (e.g., `rtsp://admin:pass@192.168.1.10/stream`). |
| `SPEED_CALCULATION_FPS` | Set this to your video's FPS (e.g., 30) for accurate speed math. |
| `PIXELS_PER_METER` | **Calibration**: How many pixels = 1 meter? (Default: 50). Decrease if cars look slow. |
| `SHOW_GUI` | `True` to see the window, `False` for headless servers. |

---

## 🚀 Execution Flow

### 1. Setup
Make sure you have the `.env` file with `SUPABASE_URL` and `SUPABASE_KEY` in `worker/`.

### 2. Run
Simply execute the batch script:
```powershell
.\run_worker.bat
```
This script handles:
- Python Environment Activation (`.venv`)
- Dependency Checks (`pip install...`)
- Cache Clearing
- Starting the Process

### 3. Monitoring
Check the **Admin Dashboard** (`/admin/junctions`) to see your worker online!

---

## 🔧 Troubleshooting

*   **"Database Sync Error"**: Check your `.env` keys.
*   **"Video Open Failed"**: Check the `VIDEO_SOURCE` path. Use absolute paths if unsure.
*   **"Slow Performance"**: 
    - Reduce resolution of input video.
    - `SHOW_GUI = False` speeds up processing.
    - Ensure CUDA (NVIDIA GPU) is installed.
