import { BrowserRouter as Router, Routes, Route, Link, Outlet } from 'react-router-dom';
import RoutePlanner from './pages/RoutePlanner';
import AdminLayout from './admin/layouts/AdminLayout';
import AdminLogin from './admin/pages/AdminLogin';
import NewAdminDashboard from './admin/pages/AdminDashboard';
import Junctions from './admin/pages/Junctions';
import Violations from './admin/pages/Violations';
import Challans from './admin/pages/Challans';
import Analytics from './admin/pages/Analytics';
import Settings from './admin/pages/Settings';
import JunctionMonitor from './admin/pages/JunctionMonitor';
import './App.css';

// Main Layout (Minimal)
const MainLayout = () => (
  <div className="app-container" style={{ margin: 0, padding: 0 }}>
    <main className="content-area" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
      <Outlet />
    </main>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* Main Routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<RoutePlanner />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<NewAdminDashboard />} />
          <Route path="dashboard" element={<NewAdminDashboard />} />
          <Route path="junctions" element={<Junctions />} />
          <Route path="violations" element={<Violations />} />
          <Route path="challans" element={<Challans />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="monitor/:id" element={<JunctionMonitor />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
