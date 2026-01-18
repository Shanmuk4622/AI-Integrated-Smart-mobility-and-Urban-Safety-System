import { useEffect, useState } from 'react';
import './AdminDashboard.css';
import { supabase } from '../lib/supabaseClient';

interface Junction {
    id: number;
    name: string;
    location: string;
    status: string;
}

interface TrafficLog {
    junction_id: number;
    vehicle_count: number;
    congestion_level: string;
    avg_speed: number;
}

interface Violation {
    id: number;
    violation_type: string;
    timestamp: string;
}

export default function AdminDashboard() {
    const [junctions, setJunctions] = useState<Junction[]>([]);
    const [selectedJunctionId, setSelectedJunctionId] = useState<number | null>(null);

    // Stats State
    const [currentLog, setCurrentLog] = useState<TrafficLog | null>(null);
    const [recentViolations, setRecentViolations] = useState<Violation[]>([]);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        fetchJunctions();
    }, []);

    useEffect(() => {
        if (!selectedJunctionId) return;

        // 1. Fetch latest state immediately
        fetchLatestStats(selectedJunctionId);
        fetchViolations(selectedJunctionId);

        // 2. Subscribe to Realtime Updates for Traffic Logs
        const trafficChannel = supabase
            .channel('traffic-updates')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'traffic_logs', filter: `junction_id=eq.${selectedJunctionId}` },
                (payload) => {
                    const newLog = payload.new as TrafficLog;
                    setCurrentLog(newLog);

                    // Simple logic for alerts based on new data
                    if (newLog.congestion_level === 'High') {
                        addLog(`⚠️ High Congestion detected at Junction ${selectedJunctionId}`);
                    }
                }
            )
            .subscribe();

        // 3. Subscribe to Violations
        const violationChannel = supabase
            .channel('violation-updates')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'violations', filter: `junction_id=eq.${selectedJunctionId}` },
                (payload) => {
                    const newViolation = payload.new as Violation;
                    setRecentViolations(prev => [newViolation, ...prev.slice(0, 4)]);
                    addLog(`🚨 VIOLATION: ${newViolation.violation_type} detected!`);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(trafficChannel);
            supabase.removeChannel(violationChannel);
        };
    }, [selectedJunctionId]);

    const fetchJunctions = async () => {
        const { data, error } = await supabase.from('junctions').select('*').order('id');
        if (error) console.error('Error fetching junctions:', error);
        else if (data) {
            setJunctions(data);
            if (data.length > 0) setSelectedJunctionId(data[0].id);
        }
    };

    const fetchLatestStats = async (id: number) => {
        const { data } = await supabase
            .from('traffic_logs')
            .select('*')
            .eq('junction_id', id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
        if (data) setCurrentLog(data);
    };

    const fetchViolations = async (id: number) => {
        const { data } = await supabase
            .from('violations')
            .select('*')
            .eq('junction_id', id)
            .order('timestamp', { ascending: false })
            .limit(5);
        if (data) setRecentViolations(data);
    };

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)]);
    };

    const selectedJunction = junctions.find(j => j.id === selectedJunctionId);

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Smart Mobility Nexus</h1>
                <div className="status-badge online">SYSTEM ONLINE</div>
            </header>

            <div className="main-content">
                <div className="sidebar" style={{ minWidth: '250px', borderRight: '1px solid #333', padding: '1rem' }}>
                    <h3>Junctions</h3>
                    <ul className="junction-list">
                        {junctions.map(j => (
                            <li
                                key={j.id}
                                className={`junction-item ${selectedJunctionId === j.id ? 'active' : ''}`}
                                onClick={() => setSelectedJunctionId(j.id)}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    background: selectedJunctionId === j.id ? '#007bff' : 'transparent',
                                    borderRadius: '5px',
                                    marginBottom: '5px'
                                }}
                            >
                                <b>{j.name}</b>
                                <div style={{ fontSize: '0.8em', color: '#ccc' }}>{j.status}</div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="content-area" style={{ flex: 1, padding: '1rem' }}>
                    <h2>{selectedJunction?.name || 'Select a Junction'}</h2>

                    <div className="video-section">
                        <div className="video-wrapper" style={{ background: '#000', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                            {/* Placeholder for now as we don't have streaming via Supabase yet */}
                            <div>
                                <h3 style={{ color: '#fff' }}>Live Feed: {selectedJunction?.name}</h3>
                                <p>🎥 Video Worker ID: {selectedJunction?.id}</p>
                                <p>(Stream visualization via WebSocket pending)</p>
                            </div>
                        </div>
                    </div>

                    <div className="stats-panel">
                        <div className="card">
                            <h3>Vehicle Count</h3>
                            <div className="big-value">{currentLog?.vehicle_count || 0}</div>
                            <small>Current Volume</small>
                        </div>

                        <div className={`card ${currentLog?.congestion_level === 'High' ? 'alert' : ''}`}>
                            <h3>Congestion</h3>
                            <div className="big-value">{currentLog?.congestion_level || 'Unknown'}</div>
                            <small>Status</small>
                        </div>

                        <div className="card">
                            <h3>Avg Speed</h3>
                            <div className="big-value">{currentLog?.avg_speed || 0} <span style={{ fontSize: '0.5em' }}>km/h</span></div>
                            <small>Estimated</small>
                        </div>

                        <div className="card list-card">
                            <h3>Recent Violations</h3>
                            <ul>
                                {recentViolations.length > 0 ? (
                                    recentViolations.map(v => (
                                        <li key={v.id}><b>{v.violation_type}</b> <br /> <small>{new Date(v.timestamp).toLocaleTimeString()}</small></li>
                                    ))
                                ) : (
                                    <li className="empty">No recent violations</li>
                                )}
                            </ul>
                        </div>

                        <div className="logs-section" style={{ gridColumn: 'span 2' }}>
                            <h3>Live Alerts</h3>
                            <div className="logs-list">
                                {logs.map((log, i) => (
                                    <div key={i} className="log-item">{log}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

