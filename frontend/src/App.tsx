import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
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
          </div>
        </nav>

        <main className="content-area">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/user" element={<div className="placeholder">User Map coming soon...</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
