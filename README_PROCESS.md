# Project Process & Progress Log

# Project Process & Progress Log

This document tracks the development journey of the **AI Integrated Smart Mobility System**.

## System Architecture

The system follows a **Hybrid Real-Time Client-Server Architecture** designed for high-throughput video analytics.

### 1. **The Core (Backend)**
*   **Framework**: FastAPI (Python). Chosen for high performance and easy async support.
*   **AI Engine**:
    *   **YOLOv8** (Object Detection) & **EasyOCR** (Text Extraction) running on **GPU (CUDA)**.
    *   **SORT Algorithm**: Tracks vehicles across frames to assign unique IDs.
    *   **Logic Layer**: `traffic_rules.py` decides signal timings based on real-time density.
*   **Stream Protocol**: A single **WebSocket** connection streams both:
    *   **Video**: Encoded JPEG frames (Binary).
    *   **Telemetry**: Usage stats, signal status, and alerts (JSON).

### 2. **The Interface (Frontend)**
*   **Framework**: React (Vite) + TypeScript.
*   **Visuals**: Custom CSS (Glassmorphism design).
*   **State Management**: Real-time React Hooks (`useState`, `useRef`) handling 30+ updates per second.

---
- **Virtual Environment**: Created `.venv` to isolate dependencies.
- **Path Configuration**: Fixed `BASE_DIR` logic in `main.py` to correctly locate models.
- **Corrupt Files**: Resolved critical `ValueError: source code string cannot contain null bytes` by cleaning `sort/__init__.py` and eventually embedding the `SORT` algorithm directly into `ai_pipeline.py` to eliminate import risks.

## Phase 2: Frontend Simplification
- **Tailwind Removal**: Removed TailwindCSS and PostCSS complexities.
- **Plain CSS**: Refactored `AdminDashboard` and `UserView` to use standard `.css` files.
- **Components**:
    - `AdminDashboard.tsx`: For traffic authorities.
    - `UserView.tsx`: Public facing display with "Green Corridor" alerts.

## Phase 3: AI Feature Development
- **Wrong-Way Detection**: Implemented logic to detect vehicles moving against traffic flow (History: 30 frames).
- **Ambulance Detection**: Added color-based detection (Red/White dominance) to trigger Emergency signals.
- **Dynamic Signals**: Integrated density-based traffic signal timing.
- **License Plate Recognition (OCR)**:
    - Integrated `EasyOCR` and `YOLOv8`.
    - Added high-contrast Visualization (Black Box/White Text).
    - **Optimization**: Throttled OCR to run every 5th frame for performance.

## Phase 4: GPU Acceleration
- **Migration**: Wiped previous environment and installed `PyTorch` with **CUDA 12.1** support.
- **Verification**: Confirmed usage of **NVIDIA GeForce GTX 1650**.
- **Performance**: Switched `EasyOCR` to `gpu=True` and moved YOLO models to `cuda:0`.

## Phase 5: Project Cleanup (Current)
- **Restructuring**:
    - Moved AI Models/Videos to `backend/assets/`.
    - Moved utility scripts to `scripts/`.
    - Moved documentation to `docs/`.
    - Created `run_demo.bat` for one-click launching.

---

## Project Components & File Glossary
*(Use these names when referring to specific parts of the project)*

### 1. Backend (The Brain)
*   **`backend/main.py`**: The API Server. It accepts connections and streams data.
*   **`backend/app/core/ai_pipeline.py`**: The core AI logic. Runs YOLO, OCR, and Traffic Rules.
*   **`backend/app/core/traffic_rules.py`**: Logic for signal timing and green corridors.
*   **`backend/assets/`**: Folder containing `sample2.mp4` and AI models (`.pt`).

### 2. Frontend (The Face)
*   **`frontend/src/App.tsx`**: Main entry point, handles navigation.
*   **`frontend/src/pages/AdminDashboard.tsx`**: (To be built) The command center for officials.
*   **`frontend/src/pages/UserView.tsx`**: Public display showing "Green Corridor" alerts.

### 3. Tools (Scripts)
*   **`run_demo.bat`**: **Double-click this** to run the AI demo window immediately.
*   **`scripts/run_local_demo.py`**: The Python script behind the demo.
*   **`scripts/test_ws.py`**: A tool to "listen" to the backend and see raw data.
