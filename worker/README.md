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
- **Logic**: It uses Kalman Filters to predict where a car *should* be in the next frame. If a detection matches that prediction (IoU - Intersection over Union), it is assigned the same **Unique ID (Track ID)**.
- **Benefit**: Allows us to count unique vehicles and calculate lane density over time, rather than just per-frame counts.

### 3. Violation Logic & Rules
**File**: `core/processor.py` & `core/traffic_rules.py`
Once we have tracks, we apply spatial rules:
- **Wrong Way**: We track the vector of movement (History of Y-coordinates). If a vehicle moves *up* (negative Y) in a lane designated for *down* movement, it triggers a violation.
- **Ambulance Detection**: A secondary check analyzes the color spectrum of large vehicles. If a significant percentage of pixels are "Emergency Red/Orange", it flags an Ambulance, which triggers high-priority signal changes.
- **Plate Recognition**: Every 5th frame, an **EasyOCR** pass checks relevant bounding boxes for text. To prevent flickering, we use a "Plate Smoother" (`PlateSmoother` class) that keeps the highest-confidence reading for each ID.

### 4. Cloud Synchronization (Supabase)
**File**: `services/supabase_client.py`
The worker does not store heavy data locally.
- **Startup**: It registers itself (Name, Coordinates) in the `junctions` table.
- **Real-Time**: 
    - **Traffic Logs**: Pushes aggregated stats (Vehicle Count, Density) every 5 seconds to `traffic_logs`.
    - **Violations**: Pushes events *immediately* to the `violations` table.

---

## ⚙️ Configuration
**Everything** is controlled via `worker/config.py`. You do not need to edit code to change settings.

```python
# worker/config.py
VIDEO_SOURCE = "Videos/sample3.mp4" # or RTSP URL
COORDINATES = "40.7128,-74.0060" # Updates the map automatically
```

## 🚀 Execution Flow
1. Run `run_worker.bat`.
2. Python Process starts -> Loads Models -> Connects to Supabase.
3. Main Loop: `Capture -> YOLO -> SORT -> Rules -> Visualize -> Sync`.
