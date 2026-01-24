import { BrowserRouter as Router, Routes, Route, Link, Outlet } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserView from './pages/UserView';
import RoutePlanner from './pages/RoutePlanner';
import ViolationsSimple from './pages/ViolationsSimple';
import AdminLayout from './admin/layouts/AdminLayout';
import AdminLogin from './admin/pages/AdminLogin';
import NewAdminDashboard from './admin/pages/AdminDashboard';
import Junctions from './admin/pages/Junctions';
import Violations from './admin/pages/Violations';
import Challans from './admin/pages/Challans';
import Analytics from './admin/pages/Analytics';
import Settings from './admin/pages/Settings';
import './App.css';

// Layout for the main/public view
const MainLayout = () => (
  <div className="app-container">
    <nav className="sidebar">
      <div className="logo-area">Smart City Layout</div>
      <div className="nav-links">
        <Link to="/" className="nav-item">Dashboard</Link>
        <Link to="/user" className="nav-item">User Map</Link>
        <Link to="/violations" className="nav-item">Violations</Link>
        <Link to="/route" className="nav-item" style={{ border: '1px solid #4facfe', color: '#4facfe' }}>Route Planner</Link>
        <Link to="/admin/login" className="nav-item" style={{ marginTop: 'auto', color: '#666', fontSize: '0.8em' }}>Admin Control</Link>
      </div>
    </nav>

    <main className="content-area">
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
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/user" element={<UserView />} />
          <Route path="/violations" element={<ViolationsSimple />} />
          <Route path="/route" element={<RoutePlanner />} />
        </Route>

        {/* New Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<NewAdminDashboard />} />
          <Route path="dashboard" element={<NewAdminDashboard />} />
          <Route path="junctions" element={<Junctions />} />
          <Route path="violations" element={<Violations />} />
          <Route path="challans" element={<Challans />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

