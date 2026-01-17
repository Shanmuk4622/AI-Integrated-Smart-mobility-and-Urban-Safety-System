import { useEffect, useState, useRef } from 'react';
import './AdminDashboard.css';

interface SignalStatus {
    action: "GREEN" | "RED";
    duration: number;
    reason: string;
}

interface StreamStats {
    density: number;
    signal: SignalStatus;
    ambulance: boolean;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<StreamStats | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const imgRef = useRef<HTMLImageElement>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        ws.current = new WebSocket('ws://localhost:8000/ws/stream');

        ws.current.onopen = () => {
            setIsConnected(true);
            addLog("System Connected to AI Core.");
        };

        ws.current.onclose = () => {
            setIsConnected(false);
            addLog("System Disconnected.");
        };

        ws.current.onmessage = (event) => {
            if (typeof event.data === "string") {
                const data = JSON.parse(event.data);
                setStats(data);
                if (data.ambulance && !stats?.ambulance) {
                    addLog("CRITICAL: Ambulance Detected! Green Corridor Activated.");
                }
            } else if (event.data instanceof Blob) {
                const url = URL.createObjectURL(event.data);
                if (imgRef.current) {
                    imgRef.current.src = url;
                }
            }
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)]);
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Smart Mobility Nexus</h1>
                <div className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
                    {isConnected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
                </div>
            </header>

            <div className="main-content">
                <div className="video-section">
                    <div className="video-wrapper">
                        <img ref={imgRef} alt="Live Traffic Feed" className="live-feed" />
                        {!isConnected && <div className="video-placeholder">Waiting for AI Stream...</div>}
                    </div>
                </div>

                <div className="stats-panel">
                    <div className="card">
                        <h3>Traffic Density</h3>
                        <div className="big-value">{stats?.density || 0}</div>
                        <small>Vehicles Detected</small>
                    </div>

                    <div className={`card ${stats?.ambulance ? 'alert' : ''}`}>
                        <h3>Emergency Status</h3>
                        <div className="big-value">{stats?.ambulance ? 'PRIORITY' : 'NORMAL'}</div>
                        <small>{stats?.ambulance ? 'Green Corridor Active' : 'Standard Operations'}</small>
                    </div>

                    <div className="card">
                        <h3>Signal Control</h3>
                        <div className="big-value">{stats?.signal?.action || "IDLE"}</div>
                        <div className="sub-value">{stats?.signal?.duration || 0}s</div>
                        <small>{stats?.signal?.reason || "Waiting..."}</small>
                    </div>

                    <div className="logs-section">
                        <h3>Event Logs</h3>
                        <div className="logs-list">
                            {logs.map((log, i) => (
                                <div key={i} className="log-item">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
