# Smart Mobility & Urban Safety System

## 🚀 Project Overview
A scalable, AI-powered system for real-time traffic monitoring, management, and violation detection. The system uses distributed "Worker Nodes" (Python/YOLO) to process video feeds at edge locations (Junctions) and syncs data to a centralized Cloud Database (Supabase) for a React-based Dashboard.

### Core Architecture
1.  **Worker Nodes (Edge)**: Independent Python services running Computer Vision (YOLOv8 + SORT). They process video, detect vehicles/violations, and sync statistics to Supabase.
2.  **Central Database (Supabase)**: Stores junction configurations, real-time traffic logs, and violation events. Handles synchronization.
3.  **Frontend Dashboard (React)**: Visualizes live data, maps, and admin controls for city traffic management.

---

## 🛠️ System Components

### 1. Worker Service (`/worker`)
The brain of the operation. Each "Worker" represents one physical traffic junction.
- **Tech**: Python, PyTorch, YOLOv8, OpenCV, Supabase-py.
- **Features**:
    - **Vehicle Counting**: Cars, Trucks, Buses, Motorcycles.
    - **Speed/Flow**: Calculating density and flow rates.
    - **Violation Detection**: Wrong-Way driving, Red Light violations.
    - **Emergency Priority**: Ambulance detection.
    - **License Plate Recognition (ALPR)**: Using YOLO + OCR.
- **Independence**: Fully self-contained. Can be deployed on separate Raspberry Pis or Servers.

### 2. Frontend Dashboard (`/frontend`)
The control center for administrators.
- **Tech**: React, Vite, TailwindCSS, Supabase-js, Leaflet Maps.
- **Features**:
    - **Live Map**: Shows all active junctions on a map layer.
    - **Real-Time Analytics**: Charts for traffic density per junction.
    - **Violation Feeds**: Live stream of detected violations with images.
    - **Route Planning**: AI-suggested routes based on congestion.

### 3. Backend Service (`/backend`)
*Legacy Component*. Originally an all-in-one server using FastAPI. The logic has been migrated to independent workers and Supabase for scalability, but this folder contains the original API implementation and assets.

---

## 💻 Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Supabase Account (URL & Key)

### 1. Database Setup (Supabase)
Run the SQL found in `supabase_schema.sql` in your Supabase SQL Editor.
- Creates tables: `junctions`, `traffic_logs`, `violations`.
- Sets up Row Level Security (RLS) policies.

### 2. Environment Variables
Create a root `.env` or `worker/.env` file:
```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### 3. Running a Worker Node
We have simplified execution with batch scripts:

**Quick Start (Junction 1)**:
```powershell
.\run_worker.bat
```

**Configuration**:
Edit `worker/config.py` to change:
- `JUNCTION_ID`: Unique ID for this node.
- `VIDEO_SOURCE`: Path to video or RTSP URL.
- `LOCATION_NAME`: "Main St & 5th Ave".
- `COORDINATES`: "lat,long" for the map.

**Run Multiple Workers**:
```powershell
.\run_junction_2.bat
```

### 4. Running the Dashboard
```powershell
cd frontend
npm install
npm run dev
```
Access at `http://localhost:5173`.

---

## 📊 Database Schema

### `junctions`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | int8 | Unique Junction ID (Primary Key) |
| `name` | text | Display Name (e.g., "Downtown") |
| `location` | text | GPS Coordinates ("40.71,-74.00") |
| `status` | text | 'active', 'offline', 'maintenance' |

### `traffic_logs`
| Column | Type | Description |
| :--- | :--- | :--- |
| `junction_id` | int8 | Foreign Key to Junctions |
| `vehicle_count` | int | Current number of vehicles in frame |
| `congestion_level` | text | 'Low', 'Medium', 'High' |
| `timestamp` | timestamptz | Time of log |

### `violations`
| Column | Type | Description |
| :--- | :--- | :--- |
| `junction_id` | int8 | Foreign Key to Junctions |
| `violation_type` | text | 'Wrong Way', 'Red Light' |
| `image_url` | text | Link to violation snapshot |

---

## 🤝 Contribution
1.  **AI Models**: Located in `worker/assets/`.
2.  **Config**: All worker settings are centralized in `worker/config.py`.
