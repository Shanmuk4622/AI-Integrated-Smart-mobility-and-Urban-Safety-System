# Frontend Dashboard - Smart City Interface

## 🧠 How It Works
The frontend is built with **React 19, TypeScript, and Tailwind CSS**. It connects directly to Supabase for authentication and real-time data, serving two main audiences: **Citizens** (Public Map) and **Officials** (Admin Panel).

### 1. The Map Layer (Google Maps)
**File**: `src/components/RoadMap.tsx`
We migrated from Leaflet to **Google Maps Platform** for superior routing and visualization.
- **Rendering**: Markers representing active junctions are plotted dynamically.
- **Real-Time Coloring**: Markers change color (Blue -> Orange -> Red) based on live congestion data streamed from Supabase.
- **Routing**: `RoutePlanner.tsx` uses the maps API to calculate paths and reroute users around detected high-density zones.

### 2. The Admin Panel (`/admin`)
**File**: `src/admin/layouts/AdminLayout.tsx`
A secure, restricted area for traffic managers.
- **Authentication**: Uses `useAdminAuth` hook to verify Supabase Roles (RBAC). Only users with `role: 'super_admin'` can access.
- **Junction Dashboard (`/admin/junctions`)**: A live grid view of all Worker Nodes, showing their connection status (Active/Offline), Hardware Health (CPU/FPS), and Configuration.
- **Violation Review**: Interfaces to review captured images of red-light runners.

### 3. Real-Time Data (Supabase)
The app uses WebSockets to listen for database changes instantly.
```typescript
// Example: Listening for new Violations
supabase
  .channel('violations')
  .on('postgres_changes', { event: 'INSERT', table: 'violations' }, (payload) => {
      showAlert(payload.new); // Immediate UI Popup
  })
  .subscribe();
```

---

## 📂 Key Directories
*   **`src/admin/`**: The NEW Admin Panel pages and layouts.
*   **`src/components/`**: Reusable UI widgets (Charts, Maps, Modals).
*   **`src/pages/`**: Public-facing pages (Home, Route Planner).
*   **`src/lib/`**: Supabase client and utility functions.

---

## 🛠️ Setup & Run
1.  **Install Dependencies**: 
    ```bash
    npm install
    ```
2.  **Environment**: 
    Create `.env` based on `.env.example`:
    ```ini
    VITE_SUPABASE_URL=...
    VITE_SUPABASE_ANON_KEY=...
    VITE_GOOGLE_MAPS_API_KEY=...
    ```
3.  **Run Development Server**: 
    ```bash
    npm run dev
    ```
    Access: `http://localhost:5173`

---
*Powered by React 19 & Vite*
