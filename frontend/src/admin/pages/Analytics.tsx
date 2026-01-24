import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    BarChart3,
    TrendingUp,
    RefreshCw,
    Car,
    AlertTriangle,
    IndianRupee,
    Clock,
    MapPin
} from 'lucide-react';

interface TrafficStat {
    hour: number;
    avg_vehicles: number;
    total_logs: number;
}

interface JunctionStat {
    junction_id: number;
    name: string;
    total_vehicles: number;
    total_violations: number;
    congestion_minutes: number;
}

export default function Analytics() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [trafficByHour, setTrafficByHour] = useState<TrafficStat[]>([]);
    const [violationsByType, setViolationsByType] = useState<{ type: string; count: number }[]>([]);
    const [junctionStats, setJunctionStats] = useState<JunctionStat[]>([]);
    const [overview, setOverview] = useState({
        totalVehiclesToday: 0,
        totalViolationsToday: 0,
        revenueToday: 0,
        activeJunctions: 0
    });

    const fetchAnalytics = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            // Fetch traffic logs for today grouped by hour
            const { data: trafficLogs } = await supabase
                .from('traffic_logs')
                .select('vehicle_count, timestamp')
                .gte('timestamp', todayISO);

            // Process hourly stats
            const hourlyMap = new Map<number, { total: number; count: number }>();
            trafficLogs?.forEach(log => {
                const hour = new Date(log.timestamp).getHours();
                const existing = hourlyMap.get(hour) || { total: 0, count: 0 };
                hourlyMap.set(hour, {
                    total: existing.total + log.vehicle_count,
                    count: existing.count + 1
                });
            });

            const hourlyStats: TrafficStat[] = [];
            for (let h = 0; h < 24; h++) {
                const data = hourlyMap.get(h);
                hourlyStats.push({
                    hour: h,
                    avg_vehicles: data ? Math.round(data.total / data.count) : 0,
                    total_logs: data?.count || 0
                });
            }
            setTrafficByHour(hourlyStats);

            // Fetch violations by type
            const { data: violations } = await supabase
                .from('violations')
                .select('violation_type, timestamp')
                .gte('timestamp', todayISO);

            const typeMap = new Map<string, number>();
            violations?.forEach(v => {
                typeMap.set(v.violation_type, (typeMap.get(v.violation_type) || 0) + 1);
            });

            const violationTypes = Array.from(typeMap.entries()).map(([type, count]) => ({
                type,
                count
            })).sort((a, b) => b.count - a.count);
            setViolationsByType(violationTypes);

            // Fetch junction stats
            const { data: junctions } = await supabase
                .from('junctions')
                .select('id, name, status');

            const jStats: JunctionStat[] = [];
            for (const j of junctions || []) {
                const { count: vCount } = await supabase
                    .from('violations')
                    .select('*', { count: 'exact', head: true })
                    .eq('junction_id', j.id)
                    .gte('timestamp', todayISO);

                const { data: tLogs } = await supabase
                    .from('traffic_logs')
                    .select('vehicle_count, congestion_level')
                    .eq('junction_id', j.id)
                    .gte('timestamp', todayISO);

                const totalVehicles = tLogs?.reduce((sum, l) => sum + l.vehicle_count, 0) || 0;
                const congestionMins = tLogs?.filter(l => l.congestion_level === 'High').length || 0;

                jStats.push({
                    junction_id: j.id,
                    name: j.name,
                    total_vehicles: totalVehicles,
                    total_violations: vCount || 0,
                    congestion_minutes: congestionMins
                });
            }
            setJunctionStats(jStats.sort((a, b) => b.total_vehicles - a.total_vehicles));

            // Calculate overview
            const totalVehicles = trafficLogs?.reduce((sum, l) => sum + l.vehicle_count, 0) || 0;
            const totalViolations = violations?.length || 0;
            const activeCount = junctions?.filter(j => j.status === 'active').length || 0;

            // Revenue from citations today
            const { data: citations } = await supabase
                .from('citations')
                .select('fine_amount, paid')
                .gte('created_at', todayISO)
                .eq('paid', true);

            const revenue = citations?.reduce((sum, c) => sum + c.fine_amount, 0) || 0;

            setOverview({
                totalVehiclesToday: totalVehicles,
                totalViolationsToday: totalViolations,
                revenueToday: revenue,
                activeJunctions: activeCount
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchAnalytics().finally(() => setLoading(false));
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAnalytics();
        setRefreshing(false);
    };

    const maxHourlyVehicles = Math.max(...trafficByHour.map(h => h.avg_vehicles), 1);

    const getViolationColor = (type: string) => {
        switch (type) {
            case 'Wrong Way': return 'bg-red-500';
            case 'Red Light': return 'bg-orange-500';
            case 'Speeding': return 'bg-yellow-500';
            case 'No Helmet': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={32} className="text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="text-purple-500" />
                        Analytics Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">Traffic insights and violation trends for today</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Vehicles Today</p>
                            <p className="text-3xl font-bold mt-1">{overview.totalVehiclesToday.toLocaleString()}</p>
                        </div>
                        <Car size={32} className="text-blue-200" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-red-100 text-sm">Violations Today</p>
                            <p className="text-3xl font-bold mt-1">{overview.totalViolationsToday}</p>
                        </div>
                        <AlertTriangle size={32} className="text-red-200" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm">Revenue Today</p>
                            <p className="text-3xl font-bold mt-1 flex items-center">
                                <IndianRupee size={24} />
                                {overview.revenueToday.toLocaleString()}
                            </p>
                        </div>
                        <IndianRupee size={32} className="text-emerald-200" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Active Junctions</p>
                            <p className="text-3xl font-bold mt-1">{overview.activeJunctions}</p>
                        </div>
                        <MapPin size={32} className="text-purple-200" />
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Traffic by Hour Chart */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        Traffic by Hour (Today)
                    </h3>
                    <div className="flex items-end gap-1 h-48">
                        {trafficByHour.map((stat, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                <div
                                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                    style={{
                                        height: `${(stat.avg_vehicles / maxHourlyVehicles) * 100}%`,
                                        minHeight: stat.avg_vehicles > 0 ? '4px' : '0'
                                    }}
                                    title={`${stat.hour}:00 - ${stat.avg_vehicles} avg vehicles`}
                                />
                                {i % 3 === 0 && (
                                    <span className="text-xs text-gray-400 mt-1">{stat.hour}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">Hour of Day (0-23)</p>
                </div>

                {/* Violations by Type */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-500" />
                        Violations by Type (Today)
                    </h3>
                    {violationsByType.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-gray-400">
                            No violations today
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {violationsByType.map((v, i) => {
                                const maxCount = violationsByType[0]?.count || 1;
                                const percentage = (v.count / maxCount) * 100;
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-700">{v.type}</span>
                                            <span className="text-gray-500">{v.count}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div
                                                className={`h-3 rounded-full ${getViolationColor(v.type)}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Junction Performance Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" />
                        Junction Performance (Today)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Junction</th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Vehicles</th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Violations</th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Congestion (mins)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {junctionStats.map((j) => (
                                <tr key={j.junction_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{j.name}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">{j.total_vehicles.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-medium ${j.total_violations > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {j.total_violations}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-medium ${j.congestion_minutes > 30 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {j.congestion_minutes}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {junctionStats.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                        No junction data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
