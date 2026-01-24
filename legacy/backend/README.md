# Legacy Backend - Architectural Context

## 🧠 Evolution of the Architecture
This project started as a **Centralized Monolith**. 
- **Old Way**: The Backend `main.py` received video streams, processed them with AI, and emitted results via WebSockets.
- **Problem**: Python's Global Interpreter Lock (GIL) and the heavy compute load of YOLO meant one server could only handle 1-2 streams before lagging.

## 🔄 The New Distributed Architecture
We moved the logic to the `/worker` directory to create a **Decentralized Edge Architecture**.

### Why this `backend` folder still exists
1.  **Reference Implementation**: Contains the original API schemas and `SmartMobilitySystem` class that was refactored into `JunctionProcessor`.
2.  **Asset Storage**: Original location for `yolov8n.pt` and `sample.mp4` (though these are now duplicated into `worker` for independence).

### Operational Status
- **Active Code**: None. The system currently runs using **Supabase** as the backend-as-a-service.
- **Processing**: Handled by `worker/`.
- **Client**: Handled by `frontend/`.

Only use this directory if you intend to restart the legacy FastAPI server.
