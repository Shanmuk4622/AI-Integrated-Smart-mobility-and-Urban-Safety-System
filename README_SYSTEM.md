# Smart Mobility System - Run Instructions

## 1. Installation
Run the provided automated script to install all dependencies for both Backend and Frontend.
Double-click: `install_dependencies.bat`

## 2. Running the System
You need to run two terminals.

**Terminal 1: Backend (AI Core)**
```bash
cd backend
uvicorn main:app --reload
```
*Wait for "Models loaded successfully" message.*

**Terminal 2: Frontend (Dashboard)**
```bash
cd frontend
npm run dev
```
*Open the URL shown (usually http://localhost:5173).*

## 3. Features Implemented
- **AI Core**: Processes `sample2.mp4` with YOLOv8 + SORT.
- **Traffic Rules**:
    - **Density-based Signals**: Adjusts green light duration based on car count.
    - **Emergency Priority**: Detects ambulances (blue box) and forces Green Light.
- **Dashboard**:
    - Live Video Feed with Overlays (Bounding Boxes, Signal Status).
    - Real-time Stats (Density, Signal Timer).
    - Connection Status.

## 4. Configuration
Edit `backend/main.py` to change the video source path if needed.
