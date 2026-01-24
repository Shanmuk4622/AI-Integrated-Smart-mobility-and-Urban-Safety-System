import { useEffect, useState, useCallback } from 'react';
import {
    getDashboardStats,
    getJunctionsWithTraffic,
    getRecentTrafficLogs,
    subscribeToTrafficUpdates,
    getViolations,
    type DashboardStats,
    type JunctionWithTraffic,
    type TrafficDataPoint
} from '../../lib/supabaseAdmin';
import type { AdminViolation } from '../../types';
import {
    Receipt,
    IndianRupee,
    MapPin,
    AlertTriangle,
    Car,
    Ambulance,
    RefreshCw,
    TrendingUp,
    Clock,
    Activity,
    ChevronRight,
    Wifi,
    WifiOff,
    Zap
} from 'lucide-react';

// Simple line chart component
function MiniLineChart({ data, height = 80 }: { data: TrafficDataPoint[]; height?: number }) {
    if (data.length < 2) {
        return (
            <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                No data available
            </div>
        );
    }

    const maxCount = Math.max(...data.map(d => d.vehicleCount), 1);
    const minCount = Math.min(...data.map(d => d.vehicleCount));
    const range = maxCount - minCount || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = height - ((d.vehicleCount - minCount) / range) * (height - 10) - 5;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative" style={{ height }}>
            <svg width="100%" height={height} className="overflow-visible">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <polygon
                    points={`0,${height} ${points} 100,${height}`}
                    fill="url(#lineGradient)"
                />
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Latest point dot */}
                {data.length > 0 && (
                    <circle
                        cx="100%"
                        cy={height - ((data[data.length - 1].vehicleCount - minCount) / range) * (height - 10) - 5}
                        r="4"
                        fill="#3B82F6"
                    />
                )}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400">
                <span>{data.length > 0 ? new Date(data[0].timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <span>{data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
        </div>
    );
}

// Stats card component
function StatsCard({
    title,
    value,
    icon: Icon,
    color,
    trend
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    trend?: { value: number; label: string };
}) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };

    return (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    {trend && (
                        <div className="flex items-center gap-1 mt-2">
                            <TrendingUp size={14} className={trend.value >= 0 ? 'text-green-500' : 'text-red-500'} />
                            <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trend.value >= 0 ? '+' : ''}{trend.value}%
                            </span>
                            <span className="text-xs text-gray-400">{trend.label}</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
                    <Icon size={22} />
                </div>
            </div>
        </div>
    );
}

// Junction details panel
function JunctionDetailsPanel({
    junction,
    trafficData,
    onClose
}: {
    junction: JunctionWithTraffic | null;
    trafficData: TrafficDataPoint[];
    onClose: () => void;
}) {
    if (!junction) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 h-full flex flex-col items-center justify-center text-gray-400">
                <MapPin size={48} className="mb-4 opacity-50" />
                <p className="text-center">Click on a junction on the map to view details</p>
            </div>
        );
    }

    const getCongestionBadge = (level: string) => {
        switch (level) {
            case 'High': return 'bg-red-500 text-white';
            case 'Medium': return 'bg-yellow-500 text-white';
            default: return 'bg-green-500 text-white';
        }
    };

    const timeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6 h-full flex flex-col text-white">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold">{junction.name}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${getCongestionBadge(junction.congestionLevel)}`}>
                        {junction.congestionLevel.toUpperCase()} TRAFFIC
                    </span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
            </div>

            <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Vehicles</p>
                        <p className="text-2xl font-bold">{junction.currentVehicleCount}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Violations</p>
                        <p className="text-2xl font-bold text-orange-400">{junction.recentViolations}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                    <Clock size={16} className="text-gray-400" />
                    <span className="text-gray-300">Last Update: <strong>{timeAgo(junction.lastUpdate)}</strong></span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                    {junction.status === 'active' ? (
                        <>
                            <Wifi size={16} className="text-green-400" />
                            <span className="text-green-400">Online</span>
                        </>
                    ) : (
                        <>
                            <WifiOff size={16} className="text-red-400" />
                            <span className="text-red-400">Offline</span>
                        </>
                    )}
                </div>

                {/* Traffic chart */}
                <div className="mt-4">
                    <p className="text-gray-400 text-xs mb-2">Traffic (Last 30 min)</p>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                        <MiniLineChart data={trafficData} height={100} />
                    </div>
                </div>
            </div>

            <button className="mt-4 w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Activity size={18} />
                View Full Details
            </button>
        </div>
    );
}

// Junction marker on map (simplified visual representation)
function JunctionMarker({
    junction,
    isSelected,
    onClick
}: {
    junction: JunctionWithTraffic;
    isSelected: boolean;
    onClick: () => void;
}) {
    const getColor = (level: string) => {
        switch (level) {
            case 'High': return 'bg-red-500 border-red-300';
            case 'Medium': return 'bg-yellow-500 border-yellow-300';
            default: return 'bg-green-500 border-green-300';
        }
    };

    return (
        <button
            onClick={onClick}
            className={`
                absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200
                ${isSelected ? 'scale-150 z-20' : 'hover:scale-125 z-10'}
            `}
            style={{
                left: `${((junction.longitude - 78.4) / 0.2) * 100}%`,
                top: `${100 - ((junction.latitude - 17.3) / 0.3) * 100}%`,
            }}
        >
            <div className={`
                w-4 h-4 rounded-full border-2 shadow-lg
                ${getColor(junction.congestionLevel)}
                ${isSelected ? 'ring-4 ring-white/50' : ''}
            `}>
                {junction.status === 'active' && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-50"
                        style={{ backgroundColor: junction.congestionLevel === 'High' ? '#EF4444' : junction.congestionLevel === 'Medium' ? '#F59E0B' : '#22C55E' }}
                    />
                )}
            </div>
            {isSelected && (
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {junction.name}
                </div>
            )}
        </button>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [junctions, setJunctions] = useState<JunctionWithTraffic[]>([]);
    const [selectedJunction, setSelectedJunction] = useState<JunctionWithTraffic | null>(null);
    const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
    const [recentViolations, setRecentViolations] = useState<AdminViolation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        const [statsData, junctionsData, violationsData] = await Promise.all([
            getDashboardStats(),
            getJunctionsWithTraffic(),
            getViolations('all', 5)
        ]);
        setStats(statsData);
        setJunctions(junctionsData);
        setRecentViolations(violationsData);
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [fetchData]);

    // Fetch traffic data when junction is selected
    useEffect(() => {
        if (selectedJunction) {
            getRecentTrafficLogs(selectedJunction.id, 30).then(setTrafficData);
        } else {
            setTrafficData([]);
        }
    }, [selectedJunction]);

    // Subscribe to real-time traffic updates
    useEffect(() => {
        const unsubscribe = subscribeToTrafficUpdates((log) => {
            // Update junction traffic data
            setJunctions(prev => prev.map(j =>
                j.id === log.junction_id
                    ? { ...j, currentVehicleCount: log.vehicle_count, congestionLevel: log.congestion_level as 'Low' | 'Medium' | 'High', lastUpdate: new Date().toISOString() }
                    : j
            ));
            // If this is the selected junction, add to traffic data
            if (selectedJunction?.id === log.junction_id) {
                setTrafficData(prev => [...prev.slice(-29), { timestamp: new Date().toISOString(), vehicleCount: log.vehicle_count }]);
            }
        });
        return unsubscribe;
    }, [selectedJunction]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Traffic Command Center</h1>
                    <p className="text-gray-500">Real-time monitoring and analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">LIVE</span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatsCard
                    title="Total Challans"
                    value={stats?.totalChallans || 0}
                    icon={Receipt}
                    color="blue"
                />
                <StatsCard
                    title="Revenue Collected"
                    value={formatCurrency(stats?.revenueCollected || 0)}
                    icon={IndianRupee}
                    color="green"
                />
                <StatsCard
                    title="Active Junctions"
                    value={stats?.activeJunctions || 0}
                    icon={MapPin}
                    color="purple"
                />
                <StatsCard
                    title="Pending Violations"
                    value={stats?.pendingViolations || 0}
                    icon={AlertTriangle}
                    color="yellow"
                />
                <StatsCard
                    title="Vehicles Today"
                    value={stats?.vehiclesToday.toLocaleString() || 0}
                    icon={Car}
                    color="blue"
                />
                <StatsCard
                    title="Emergency Alerts"
                    value={stats?.emergencyAlerts || 0}
                    icon={Ambulance}
                    color="red"
                />
            </div>

            {/* Main Content: Map + Details Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map Section (2/3 width) */}
                <div className="lg:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-lg">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MapPin className="text-blue-400" />
                            <h2 className="text-white font-semibold">Junction Overview</h2>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-400 text-xs font-medium">LIVE</span>
                        </div>
                    </div>

                    {/* Simplified Map View */}
                    <div className="relative h-80 bg-gradient-to-br from-green-900/30 to-blue-900/30 overflow-hidden">
                        {/* Map background */}
                        <div className="absolute inset-0 opacity-20">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                {/* Grid lines */}
                                {[...Array(10)].map((_, i) => (
                                    <g key={i}>
                                        <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="white" strokeWidth="0.1" />
                                        <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="white" strokeWidth="0.1" />
                                    </g>
                                ))}
                            </svg>
                        </div>

                        {/* Legend */}
                        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur rounded-lg p-3 text-xs text-white">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-green-500" />
                                <span>Low Traffic</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                                <span>Medium Traffic</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500" />
                                <span>High Traffic</span>
                            </div>
                        </div>

                        {/* Junction Markers */}
                        {junctions.map(junction => (
                            <JunctionMarker
                                key={junction.id}
                                junction={junction}
                                isSelected={selectedJunction?.id === junction.id}
                                onClick={() => setSelectedJunction(
                                    selectedJunction?.id === junction.id ? null : junction
                                )}
                            />
                        ))}

                        {/* No junctions message */}
                        {junctions.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                No junctions configured
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Panel (1/3 width) */}
                <div className="lg:col-span-1">
                    <JunctionDetailsPanel
                        junction={selectedJunction}
                        trafficData={trafficData}
                        onClose={() => setSelectedJunction(null)}
                    />
                </div>
            </div>

            {/* Bottom Section: Data Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Violations */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-orange-500" />
                            Recent Violations
                        </h3>
                        <a href="/admin/violations" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                            View All <ChevronRight size={14} />
                        </a>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {recentViolations.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No recent violations</div>
                        ) : (
                            recentViolations.map(violation => (
                                <div key={violation.id} className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${violation.violation_type === 'Wrong Way' ? 'bg-red-500' :
                                                violation.violation_type === 'Red Light' ? 'bg-orange-500' :
                                                    'bg-yellow-500'
                                            }`} />
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{violation.violation_type}</p>
                                            <p className="text-xs text-gray-500">{violation.junctions?.name || `Junction ${violation.junction_id}`}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded-full ${violation.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                violation.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {violation.status}
                                        </span>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(violation.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Junction Performance */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Zap size={18} className="text-purple-500" />
                            Junction Performance
                        </h3>
                        <a href="/admin/junctions" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                            View All <ChevronRight size={14} />
                        </a>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-5 py-3 text-left">Junction</th>
                                    <th className="px-5 py-3 text-center">Vehicles</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                    <th className="px-5 py-3 text-center">Congestion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {junctions.slice(0, 5).map(junction => (
                                    <tr key={junction.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{junction.name}</td>
                                        <td className="px-5 py-3 text-sm text-center text-gray-600">{junction.currentVehicleCount}</td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 text-xs ${junction.status === 'active' ? 'text-green-600' : 'text-gray-400'
                                                }`}>
                                                {junction.status === 'active' ? <Wifi size={12} /> : <WifiOff size={12} />}
                                                {junction.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${junction.congestionLevel === 'High' ? 'bg-red-100 text-red-700' :
                                                    junction.congestionLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-green-100 text-green-700'
                                                }`}>
                                                {junction.congestionLevel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {junctions.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                                            No junctions configured
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
