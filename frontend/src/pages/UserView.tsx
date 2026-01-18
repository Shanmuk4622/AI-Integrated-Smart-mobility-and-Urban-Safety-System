import { useEffect, useState, useRef } from 'react';
import './UserView.css';

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

export default function UserView() {
    const [stats, setStats] = useState<StreamStats | null>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        ws.current = new WebSocket('ws://localhost:8000/ws/stream');

        ws.current.onmessage = (event) => {
            if (typeof event.data === "string") {
                const data = JSON.parse(event.data);
                setStats(data);
            }
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    return (
        <div className="user-view-container">
            <header className="user-header">
                <h2>City Traffic Portal</h2>
                <div className="live-indicator">LIVE UPDATES</div>
            </header>

            <div className="status-hero">
                {stats?.ambulance ? (
                    <div className="status-card emergency">
                        <h1>⚠️ EMERGENCY VEHICLE ALERT ⚠️</h1>
                        <p>Green Corridor Active. Please Clear the Way!</p>
                    </div>
                ) : (
                    <div className="status-card normal">
                        <h1>Traffic Normal</h1>
                        <p>Drive Safely</p>
                    </div>
                )}
            </div>

            <div className="info-grid">
                <div className="info-card">
                    <h3>Current Signal</h3>
                    <div className={`signal-light ${stats?.signal?.action === 'GREEN' ? 'green' : 'red'}`}>
                        {stats?.signal?.action || 'WAIT'}
                    </div>
                    <p>Duration: {stats?.signal?.duration || 0}s</p>
                </div>

                <div className="info-card">
                    <h3>Junction Density</h3>
                    <div className="density-meter">
                        {stats?.density || 0} Vehicles
                    </div>
                </div>
            </div>

            <footer className="user-footer">
                <p>Safety First. Obey Traffic Rules.</p>
            </footer>
        </div>
    );
}
