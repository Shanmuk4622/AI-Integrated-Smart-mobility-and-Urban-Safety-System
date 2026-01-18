# Smart Mobility System - Project Summary

## 1. Project Overview
The **Smart Mobility & Urban Safety System** is an AI-powered dashboard designed to monitor traffic, detect urban safety incidents (like ambulances or wrong-way driving), and provide intelligent route planning that adapts to real-time conditions.

## 2. System Architecture
The system consists of two main parts:
*   **Backend (FastAPI + YOLOv8)**: Processes video feeds to detect vehicles, measure density, and identify emergency vehicles. It streams this data to the frontend via WebSockets.
*   **Frontend (React + Leaflet)**: Displays the live dashboard and providing the Route Planner interface.

## 3. Workflow Description
How the "Dynamic Rerouting" features works:

1.  **User Input**:
    *   The user goes to **Route Planner**.
    *   They type a start ("Big Ben") and end ("Tower of London").
    *   The system uses **Nominatim** to get the coordinates.
2.  **Route Calculation**:
    *   The system sends these coordinates to the **OSRM Routing Engine**.
    *   It draws the **Blue Path** (Optimal) and **Grey Paths** (Alternatives) with time/distance labels.
3.  **Real-Time AI Monitoring**:
    *   The Backend watches a video feed of a "Central Junction" (simulated).
    *   If it detects:
        *   **High Density** (>10 cars) OR
        *   **Ambulance** (Emergency Vehicle)
    *   It sends a signal: `{"density": 15, "ambulance": true}`.
4.  **Dynamic Reaction**:
    *   The Frontend receives this signal.
    *   It immediately flags the Central Junction as **Congested (Red)**.
    *   It re-calculates the route, inserting a **Detour Point (Blackfriars)** to force the path *around* the congestion.
    *   The user sees the path snap to a **Red Line** (Emergency Route).

## 4. File Structure & Organization
The project is organized efficiently:

### Backend (`/backend`)
*   `main.py`: Entry point. Sets up the WebSocket server.
*   `app/core/ai_pipeline.py`: The brain. Contains YOLOv8 logic, object tracking, and rule enforcement.

### Frontend (`/frontend/src`)
*   **Pages** (`/pages`):
    *   `RoutePlanner.tsx`: **[NEW]** The main map interface with routing logic.
    *   `AdminDashboard.tsx`: Viewing live stats and video feeds.
    *   `UserView.tsx`: A simplified view for public users.
*   **Components** (`/components`):
    *   `LocationAutocomplete.tsx`: **[NEW]** Reusable search bar with dropdown suggestions.
*   **Styles**:
    *   `App.css`: Global styles, including the new `.route-label` for map badges.

## 5. Key Technologies
*   **React & TypeScript**: For a robust UI.
*   **Leaflet & React-Leaflet**: For interactive maps.
*   **OSRM (Open Source Routing Machine)**: For calculating driving paths.
*   **WebSockets**: For real-time communication.
*   **Nominatim API**: For converting addresses to coordinates (Geocoding).
