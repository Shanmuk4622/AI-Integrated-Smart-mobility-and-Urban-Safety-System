import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
    Activity,
    Video,
    Disc,
    ArrowLeft,
    Car,
    AlertTriangle,
    IndianRupee,
    Terminal,
    FileText,
    AlertOctagon,
    Zap,
    Camera
} from 'lucide-react';
import '../../styles/Monitor.css';

// Chart.js imports
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

interface JunctionData {
    id: number;
    name: string;
    video_source: string;
    status: string;
}

interface MonitorStats {
    totalVehicles: number;
    totalViolations: number;
    totalRevenue: number;
    activePlates: number; // Placeholder
    fps: number;
    cpu: number;
    lastHeartbeat: string;
}

interface LogEntry {
    id: string;
    time: string;
    level: 'info' | 'warning' | 'critical' | 'success';
    category: string;
    message: string;
}

export default function JunctionMonitor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [junction, setJunction] = useState<JunctionData | null>(null);
    const [stats, setStats] = useState<MonitorStats>({
        totalVehicles: 0,
        totalViolations: 0,
        totalRevenue: 0,
        activePlates: 0,
        fps: 0,
        cpu: 0,
        lastHeartbeat: new Date().toISOString()
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [recentViolations, setRecentViolations] = useState<any[]>([]);
    const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);

    // Chart Data State
    const [vehicleCountHistory, setVehicleCountHistory] = useState<number[]>([]);
    const [timeLabels, setTimeLabels] = useState<string[]>([]);

    useEffect(() => {
        if (id) {
            fetchJunctionDetails();
            fetchInitialStats();

            // Subscriptions
            const trafficSub = supabase
                .channel(`monitor-traffic-${id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'traffic_logs', filter: `junction_id=eq.${id}` },
                    (payload) => handleNewTrafficLog(payload.new)
                )
                .subscribe();

            const violationSub = supabase
                .channel(`monitor-violations-${id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'violations', filter: `junction_id=eq.${id}` },
                    (payload) => handleNewViolation(payload.new)
                )
                .subscribe();

            const healthSub = supabase
                .channel(`monitor-health-${id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_health', filter: `junction_id=eq.${id}` },
                    (payload) => handleNewHealthLog(payload.new)
                )
                .subscribe();

            // Live Feed Subscription (New)
            const liveFeedSub = supabase
                .channel(`monitor-feed-${id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'junctions', filter: `id=eq.${id}` },
                    (payload: any) => {
                        if (payload.new.live_snapshot_url) {
                            // Add timestamp to force recurring reload if URL is same but content changed (though URL usually changes)
                            setLiveFeedUrl(payload.new.live_snapshot_url);
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(trafficSub);
                supabase.removeChannel(violationSub);
                supabase.removeChannel(healthSub);
                supabase.removeChannel(liveFeedSub);
            };
        }
    }, [id]);

    const fetchJunctionDetails = async () => {
        if (!id) return;
        const { data } = await supabase.from('junctions').select('*').eq('id', id).single();
        if (data) {
            setJunction(data);
            if (data.live_snapshot_url) {
                setLiveFeedUrl(data.live_snapshot_url);
            }
            addLog('info', 'System', `Connected to Junction: ${data.name}`);
        }
        setLoading(false);
    };

    const fetchInitialStats = async () => {
        if (!id) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch totals
        const { count: vCount } = await supabase.from('traffic_logs').select('*', { count: 'exact', head: true }).eq('junction_id', id).gte('timestamp', today.toISOString());
        const { count: vioCount } = await supabase.from('violations').select('*', { count: 'exact', head: true }).eq('junction_id', id).gte('timestamp', today.toISOString());

        // Fetch recent violations
        const { data: recentVio } = await supabase.from('violations').select('*').eq('junction_id', id).order('timestamp', { ascending: false }).limit(5);
        if (recentVio) setRecentViolations(recentVio);

        setStats(prev => ({
            ...prev,
            totalVehicles: vCount || 0,
            totalViolations: vioCount || 0,
            totalRevenue: (vioCount || 0) * 500 // Approx avg fine
        }));
    };

    const handleNewTrafficLog = (log: any) => {
        setStats(prev => ({ ...prev, totalVehicles: prev.totalVehicles + log.vehicle_count }));

        // Update Chart
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setTimeLabels(prev => [...prev.slice(-29), timeLabel]);
        setVehicleCountHistory(prev => [...prev.slice(-29), log.vehicle_count]);

        addLog('info', 'Traffic', `Vehicle update: ${log.vehicle_count} vehicles detected`);
    };

    const handleNewViolation = (violation: any) => {
        setStats(prev => ({
            ...prev,
            totalViolations: prev.totalViolations + 1,
            totalRevenue: prev.totalRevenue + 500 // Assuming default fine
        }));
        setRecentViolations(prev => [violation, ...prev].slice(0, 10));
        addLog('warning', 'Violation', `New ${violation.violation_type} detected!`);
    };

    const handleNewHealthLog = (health: any) => {
        setStats(prev => ({
            ...prev,
            fps: health.fps,
            cpu: health.cpu_usage,
            lastHeartbeat: health.last_heartbeat
        }));
    };

    const addLog = (level: LogEntry['level'], category: string, message: string) => {
        const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString(),
            level,
            category,
            message
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50));
    };

    const chartData = {
        labels: timeLabels,
        datasets: [
            {
                label: 'Vehicles',
                data: vehicleCountHistory,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 1
            }
        ]
    };

    if (loading) return <div className="p-10 text-center">Loading Monitor...</div>;

    return (
        <div className="monitor-body">
            {/* Header */}
            <header className="monitor-header">
                <div className="monitor-logo cursor-pointer" onClick={() => navigate('/admin/junctions')}>
                    <ArrowLeft size={24} className="text-gray-500 mr-2 hover:text-blue-600" />
                    <Car size={32} className="text-blue-600" />
                    <h1>{junction?.name || 'Junction Monitor'}</h1>
                </div>
                <div className="monitor-header-info">
                    <div className="status-indicator">
                        <span className={`status-dot ${junction?.status === 'active' ? 'active' : 'inactive'}`}></span>
                        <span id="statusText">{junction?.status === 'active' ? 'System Active' : 'System Offline'}</span>
                    </div>
                    <div className="datetime">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
                </div>
            </header>

            {/* Main Content */}
            <div className="monitor-main-container">
                {/* Left Column */}
                <div className="left-column">
                    {/* Stats Grid */}
                    <div className="monitor-stats-grid">
                        <div className="monitor-stat-card blue">
                            <div className="monitor-stat-icon"><IndianRupee /></div>
                            <div className="monitor-stat-value">₹{stats.totalRevenue.toLocaleString()}</div>
                            <div className="monitor-stat-label">Estimated Revenue</div>
                        </div>
                        <div className="monitor-stat-card green">
                            <div className="monitor-stat-icon"><Activity /></div>
                            <div className="monitor-stat-value">{stats.fps.toFixed(1)}</div>
                            <div className="monitor-stat-label">Current FPS</div>
                        </div>
                        <div className="monitor-stat-card red">
                            <div className="monitor-stat-icon"><AlertTriangle /></div>
                            <div className="monitor-stat-value">{stats.totalViolations}</div>
                            <div className="monitor-stat-label">Violations Today</div>
                        </div>
                        <div className="monitor-stat-card orange">
                            <div className="monitor-stat-icon"><Car /></div>
                            <div className="monitor-stat-value">{stats.totalVehicles}</div>
                            <div className="monitor-stat-label">Total Vehicles</div>
                        </div>
                    </div>

                    {/* Video Feed */}
                    <div className="monitor-card">
                        <div className="monitor-card-header">
                            <div className="monitor-card-title">
                                <Video size={20} className="mr-2" />
                                Live Video Feed
                            </div>
                            <div className="video-badge live">
                                <Disc size={10} className="mr-1 animate-pulse" /> LIVE
                            </div>
                        </div>
                        <div className="monitor-card-body" style={{ padding: 0 }}>
                            <div className="video-container">
                                {liveFeedUrl ? (
                                    /* Double buffer or just simple img without key to prevent flickering */
                                    <img
                                        src={liveFeedUrl}
                                        alt="Live Feed"
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494587416117-f101a292419d?q=80&w=1000&auto=format&fit=crop';
                                        }}
                                    />
                                ) : (
                                    <>
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-0">
                                            <p>Waiting for feed...</p>
                                        </div>
                                        <img
                                            src="https://images.unsplash.com/photo-1494587416117-f101a292419d?q=80&w=1000&auto=format&fit=crop"
                                            alt="Video Feed Placeholder"
                                            className="opacity-20 w-full h-full object-cover"
                                        />
                                    </>
                                )}

                                <div className="video-overlay">
                                    <div className="video-badge">
                                        <Camera size={12} className="mr-1" /> Camera 1
                                    </div>
                                    <div className="video-badge">
                                        <Activity size={12} className="mr-1" /> {stats.fps.toFixed(0)} FPS
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="heatmap-section">
                        <div className="monitor-card">
                            <div className="monitor-card-header">
                                <div className="monitor-card-title">
                                    <Zap size={20} className="mr-2" />
                                    Traffic Trend
                                </div>
                            </div>
                            <div className="monitor-card-body">
                                <div className="monitor-chart-container">
                                    <Line
                                        data={chartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                x: { display: false },
                                                y: { beginAtZero: true }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="monitor-card">
                            <div className="monitor-card-header">
                                <div className="monitor-card-title">
                                    <AlertOctagon size={20} className="mr-2" />
                                    Recent Activity
                                </div>
                            </div>
                            <div className="monitor-card-body">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">CPU Usage</span>
                                        <span className="font-mono font-bold text-blue-600">{stats.cpu.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(stats.cpu, 100)}%` }}></div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm mt-4">
                                        <span className="text-gray-500">Memory Usage</span>
                                        <span className="font-mono font-bold text-purple-600">45%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="right-column">
                    {/* Recent Violations */}
                    <div className="monitor-card">
                        <div className="monitor-card-header">
                            <div className="monitor-card-title">
                                <FileText size={20} className="mr-2" />
                                Recent Violations
                            </div>
                            <span className="plate-confidence">{stats.totalViolations}</span>
                        </div>
                        <div className="monitor-card-body" style={{ padding: 0 }}>
                            <div className="violations-container">
                                {recentViolations.length === 0 ? (
                                    <div className="p-4 text-center text-gray-400 text-sm">No violations yet</div>
                                ) : (
                                    recentViolations.map((v, i) => (
                                        <div key={i} className="violation-entry">
                                            <div className={`violation-icon ${v.violation_type === 'Red Light' ? 'critical' : 'high'}`}>
                                                <AlertTriangle size={16} />
                                            </div>
                                            <div className="violation-content">
                                                <div className="violation-type">{v.violation_type}</div>
                                                <div className="violation-desc">Detected at {new Date(v.timestamp).toLocaleTimeString()}</div>
                                                {v.license_plate && <div className="violation-plate">{v.license_plate}</div>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* System Logs */}
                    <div className="monitor-card" style={{ flex: 1 }}>
                        <div className="monitor-card-header">
                            <div className="monitor-card-title">
                                <Terminal size={20} className="mr-2" />
                                System Logs
                            </div>
                        </div>
                        <div className="monitor-card-body" style={{ padding: 0 }}>
                            <div className="logs-container">
                                {logs.map((log) => (
                                    <div key={log.id} className="log-entry">
                                        <span className="log-time">{log.time}</span>
                                        <span className={`log-level ${log.level}`}>{log.level}</span>
                                        <span className="log-category">[{log.category}]</span>
                                        <span className="log-message">{log.message}</span>
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <div className="p-4 text-gray-400 text-sm italic">Waiting for logs...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
