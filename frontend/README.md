# Frontend Dashboard - Technical Overview

## 🧠 How It Works
The frontend is a **Real-Time Reactive Application**. Unlike traditional dashboards that poll a server every few seconds ("Are there updates?"), this application maintains an open socket connection to Supabase to receive updates *instantly*.

### 1. The Map Layer (Leaflet)
**File**: `src/pages/AdminDashboard.tsx`, `src/pages/UserView.tsx`
- **Initialization**: On load, it fetches the static list of `junctions` from Supabase (ID, Name, Coordinates).
- **Rendering**: Uses `react-leaflet` to plot these points on an OpenStreetMap layer.
- **Interaction**: Clicking a marker sets the `activeJunction` state, triggering the sidebar to load specific data for that node.

### 2. Real-Time Data Streams (Supabase Realtime)
**File**: `src/lib/supabaseClient.ts`, `src/pages/AdminDashboard.tsx`
This is the core of the "Live" experience.
- **Traffic Logs**: We subscribe to `INSERT` events on the `traffic_logs` table.
    ```typescript
    supabase
      .channel('traffic_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'traffic_logs' }, (payload) => {
          // payload.new contains the latest { vehicle_count, congestion_level }
          updateStats(payload.new);
      })
      .subscribe();
    ```
- **Violations**: A separate channel listens for `violations`. When a worker logs a "Wrong Way" driver, the alert appears on the dashboard milliseconds later.

### 3. Route Planning Algorithm
**File**: `src/pages/RoutePlanner.tsx`
- **Logic**: It fetches the latest traffic density for *all* junctions.
- **Weighting**: It calculates a "Cost" for potential routes. 
    - `Cost = Distance * (1 + Congestion_Factor)`
    - High congestion (Density > 20) increases the travel cost of a route, causing the logic to suggest alternative paths.

---

## 🛠️ Setup & Run
1.  **Install Dependencies**: `npm install`
2.  **Environment**: `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3.  **Run**: `npm run dev`
