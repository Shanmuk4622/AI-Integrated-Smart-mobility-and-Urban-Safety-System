import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserView from './pages/UserView';
import RoutePlanner from './pages/RoutePlanner';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="sidebar">
          <div className="logo-area">Smart City Layout</div>
          <div className="nav-links">
            <Link to="/" className="nav-item">Dashboard</Link>
            <Link to="/user" className="nav-item">User Map</Link>
            <Link to="/route" className="nav-item" style={{ border: '1px solid #4facfe', color: '#4facfe' }}>Route Planner</Link>
          </div>
        </nav>

        <main className="content-area">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/user" element={<UserView />} />
            <Route path="/route" element={<RoutePlanner />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
