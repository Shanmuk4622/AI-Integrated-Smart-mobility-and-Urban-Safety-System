import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Activity, Signal, Cpu, Video, Disc, RefreshCw } from 'lucide-react';

interface Junction {
    id: number;
    name: string;
    location: string; // coordinates text or null
    latitude: number;
    longitude: number;
    status: 'active' | 'offline' | 'maintenance';
    video_source?: string;
    fps?: number; // Configured Target FPS
    ppm?: number; // Configured PPM
    last_health?: WorkerHealth;
}

interface WorkerHealth {
    fps: number;
    cpu_usage: number;
    memory_usage: number;
    total_detections: number;
    last_heartbeat: string;
}

export default function Junctions() {
    const [junctions, setJunctions] = useState<Junction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchJunctions = async () => {
        try {
            const { data: junctionsData, error } = await supabase
                .from('junctions')
                .select('*')
                .order('id');

            if (error) throw error;

            // For each junction, fetch latest health
            const enhancedJunctions = await Promise.all(junctionsData.map(async (j) => {
                const { data: healthData } = await supabase
                    .from('worker_health')
                    .select('*')
                    .eq('junction_id', j.id)
                    .order('last_heartbeat', { ascending: false })
                    .limit(1)
                    .single();

                return { ...j, last_health: healthData || null };
            }));

            setJunctions(enhancedJunctions);
        } catch (err) {
            console.error('Error fetching junctions:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchJunctions();

        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchJunctions, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchJunctions();
    };

    const formatTimeAgo = (dateString?: string) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };

    const getStatusColor = (status: string, lastHeartbeat?: string) => {
        // If status is active but no heartbeat in 2 minutes, consider it offline/warning
        if (status === 'active') {
            if (lastHeartbeat) {
                const diff = (new Date().getTime() - new Date(lastHeartbeat).getTime()) / 1000;
                if (diff > 60) return 'bg-amber-500'; // Warning
            }
            return 'bg-green-500';
        }
        return 'bg-slate-400';
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Junction Management</h1>
                    <p className="text-gray-500">Monitor Edge Worker status and performance.</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors ${refreshing ? 'opacity-70' : ''}`}
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {junctions.map((node) => {
                    const health = node.last_health;

                    const statusColor = getStatusColor(node.status, health?.last_heartbeat);

                    return (
                        <div key={node.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Header */}
                            <div className="p-5 border-b border-gray-50 flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-semibold text-gray-900">{node.name}</h3>
                                        <span className={`px-2 py-0.5 text-xs font-medium text-white rounded-full ${statusColor}`}>
                                            {node.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Disc size={14} /> ID: {node.id}
                                    </p>
                                </div>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Signal size={20} />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="p-5 grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Configuration</span>
                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                        <Video size={16} className="text-gray-400" />
                                        <span className="truncate max-w-[120px]" title={node.video_source || 'Unknown'}>
                                            {node.video_source ? node.video_source.split(/[/\\]/).pop() : 'Webcam'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        FPS: {node.fps || 30} | PPM: {node.ppm || 50}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Health</span>
                                    {health ? (
                                        <>
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                <Activity size={16} className="text-green-500" />
                                                <span>{health.fps.toFixed(1)} FPS</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                <Cpu size={16} className="text-blue-500" />
                                                <span>{health.cpu_usage.toFixed(1)}% CPU</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-gray-400 italic">No Data</div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 px-5 py-3 text-xs text-gray-500 border-t border-gray-100 flex justify-between items-center">
                                <span>GPS: {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}</span>
                                <span>Last Seen: {formatTimeAgo(health?.last_heartbeat)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {junctions.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <Signal size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Junctions Found</h3>
                    <p className="text-gray-500">Run a Worker Node to register your first junction.</p>
                </div>
            )}
        </div>
    );
}
