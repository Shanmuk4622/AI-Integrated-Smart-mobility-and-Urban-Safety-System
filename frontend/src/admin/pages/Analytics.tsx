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

type TimeRange = 'today' | 'week' | 'month' | 'all';

export default function Analytics() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('week'); // Default to week for better data
    const [trafficByHour, setTrafficByHour] = useState<TrafficStat[]>([]);
    const [violationsByType, setViolationsByType] = useState<{ type: string; count: number }[]>([]);
    const [junctionStats, setJunctionStats] = useState<JunctionStat[]>([]);
    const [overview, setOverview] = useState({
        totalVehiclesToday: 0,
        totalViolationsToday: 0,
        revenueToday: 0,
        activeJunctions: 0
    });

    const getDateFilter = (range: TimeRange): string | null => {
        const now = new Date();
        switch (range) {
            case 'today':
                now.setHours(0, 0, 0, 0);
                return now.toISOString();
            case 'week':
                now.setDate(now.getDate() - 7);
                return now.toISOString();
            case 'month':
                now.setMonth(now.getMonth() - 1);
                return now.toISOString();
            case 'all':
                return null;
        }
    };

    const getTimeRangeLabel = (range: TimeRange): string => {
        switch (range) {
            case 'today': return 'Today';
            case 'week': return 'Last 7 Days';
            case 'month': return 'Last 30 Days';
            case 'all': return 'All Time';
        }
    };

    const fetchAnalytics = async () => {
        try {
            const dateFilter = getDateFilter(timeRange);

            // Fetch traffic logs
            let trafficQuery = supabase
                .from('traffic_logs')
                .select('vehicle_count, timestamp, junction_id, congestion_level');

            if (dateFilter) {
                trafficQuery = trafficQuery.gte('timestamp', dateFilter);
            }

            const { data: trafficLogs, error: trafficError } = await trafficQuery;

            if (trafficError) {
                console.error('Traffic logs error:', trafficError);
            }

            console.log('📊 Traffic logs fetched:', trafficLogs?.length || 0);

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

            // Fetch violations
            let violationsQuery = supabase
                .from('violations')
                .select('violation_type, timestamp, junction_id');

            if (dateFilter) {
                violationsQuery = violationsQuery.gte('timestamp', dateFilter);
            }

            const { data: violations, error: violationsError } = await violationsQuery;

            if (violationsError) {
                console.error('Violations error:', violationsError);
            }

            console.log('🚨 Violations fetched:', violations?.length || 0);

            const typeMap = new Map<string, number>();
            violations?.forEach(v => {
                typeMap.set(v.violation_type, (typeMap.get(v.violation_type) || 0) + 1);
            });

            const violationTypes = Array.from(typeMap.entries()).map(([type, count]) => ({
                type,
                count
            })).sort((a, b) => b.count - a.count);
            setViolationsByType(violationTypes);

            // Fetch junctions
            const { data: junctions, error: junctionsError } = await supabase
                .from('junctions')
                .select('id, name, status');

            if (junctionsError) {
                console.error('Junctions error:', junctionsError);
            }

            console.log('📍 Junctions fetched:', junctions?.length || 0);

            // Build junction stats from already fetched data
            const jStats: JunctionStat[] = (junctions || []).map(j => {
                const jTraffic = trafficLogs?.filter(t => t.junction_id === j.id) || [];
                const jViolations = violations?.filter(v => v.junction_id === j.id) || [];

                return {
                    junction_id: j.id,
                    name: j.name,
                    total_vehicles: jTraffic.reduce((sum, l) => sum + l.vehicle_count, 0),
                    total_violations: jViolations.length,
                    congestion_minutes: jTraffic.filter(l => l.congestion_level === 'High').length
                };
            });

            setJunctionStats(jStats.sort((a, b) => b.total_vehicles - a.total_vehicles));

            // Calculate overview
            const totalVehicles = trafficLogs?.reduce((sum, l) => sum + l.vehicle_count, 0) || 0;
            const totalViolations = violations?.length || 0;
            const activeCount = junctions?.filter(j => j.status === 'active').length || 0;

            // Revenue from citations
            let citationsQuery = supabase
                .from('citations')
                .select('fine_amount, paid');

            if (dateFilter) {
                citationsQuery = citationsQuery.gte('created_at', dateFilter);
            }

            const { data: citations, error: citationsError } = await citationsQuery;

            if (citationsError) {
                console.error('Citations error:', citationsError);
            }

            const revenue = citations?.filter(c => c.paid).reduce((sum, c) => sum + Number(c.fine_amount), 0) || 0;

            console.log('💰 Revenue calculated:', revenue);

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
    }, [timeRange]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAnalytics();
        setRefreshing(false);
    };

    const maxHourlyVehicles = Math.max(...trafficByHour.map(h => h.avg_vehicles), 1);
    const maxViolationCount = Math.max(...violationsByType.map(v => v.count), 1);

    const getViolationColor = (type: string) => {
        switch (type) {
            case 'Wrong Way': return 'bg-red-500';
            case 'Red Light': return 'bg-orange-500';
            case 'Speeding': return 'bg-yellow-500';
            case 'No Helmet': return 'bg-purple-500';
            case 'Lane Violation': return 'bg-pink-500';
            default: return 'bg-blue-500';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <BarChart3 className="text-blue-600" />
                        Analytics Dashboard
                    </h1>
                    <p className="text-gray-500">Traffic insights and violation trends - {getTimeRangeLabel(timeRange)}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Time Range Selector */}
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                        {(['today', 'week', 'month', 'all'] as TimeRange[]).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-2 text-sm font-medium transition-colors ${timeRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {range === 'today' ? 'Today' : range === 'week' ? '7D' : range === 'month' ? '30D' : 'All'}
                            </button>
                        ))}
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

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Vehicles {getTimeRangeLabel(timeRange)}</p>
                            <p className="text-3xl font-bold mt-1">{overview.totalVehiclesToday.toLocaleString()}</p>
                        </div>
                        <Car size={32} className="text-blue-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm">Violations {getTimeRangeLabel(timeRange)}</p>
                            <p className="text-3xl font-bold mt-1">{overview.totalViolationsToday.toLocaleString()}</p>
                        </div>
                        <AlertTriangle size={32} className="text-orange-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Revenue {getTimeRangeLabel(timeRange)}</p>
                            <p className="text-3xl font-bold mt-1">{formatCurrency(overview.revenueToday)}</p>
                        </div>
                        <IndianRupee size={32} className="text-green-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Active Junctions</p>
                            <p className="text-3xl font-bold mt-1">{overview.activeJunctions}</p>
                        </div>
                        <MapPin size={32} className="text-purple-200" />
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Traffic by Hour */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        Traffic by Hour ({getTimeRangeLabel(timeRange)})
                    </h3>
                    <div className="h-48 flex items-end gap-1">
                        {trafficByHour.map((stat, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group">
                                <div className="relative w-full">
                                    <div
                                        className="w-full bg-blue-500 rounded-t transition-all group-hover:bg-blue-600"
                                        style={{
                                            height: `${(stat.avg_vehicles / maxHourlyVehicles) * 140}px`,
                                            minHeight: stat.avg_vehicles > 0 ? '4px' : '0'
                                        }}
                                    />
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                            {stat.avg_vehicles} vehicles
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-400 mt-1">{stat.hour}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">Hour of Day (0-23)</p>
                </div>

                {/* Violations by Type */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-orange-500" />
                        Violations by Type ({getTimeRangeLabel(timeRange)})
                    </h3>
                    {violationsByType.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-gray-400">
                            No violations in this period
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {violationsByType.map((vt, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${getViolationColor(vt.type)}`} />
                                    <span className="text-sm text-gray-700 flex-1">{vt.type}</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full ${getViolationColor(vt.type)} transition-all`}
                                                style={{ width: `${(vt.count / maxViolationCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                                            {vt.count}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Junction Performance Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <TrendingUp size={18} className="text-green-500" />
                        Junction Performance ({getTimeRangeLabel(timeRange)})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3 text-left">Junction</th>
                                <th className="px-6 py-3 text-right">Vehicles</th>
                                <th className="px-6 py-3 text-right">Violations</th>
                                <th className="px-6 py-3 text-right">High Congestion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {junctionStats.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                        No junction data available
                                    </td>
                                </tr>
                            ) : (
                                junctionStats.map(js => (
                                    <tr key={js.junction_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <MapPin size={16} className="text-gray-400" />
                                                <span className="font-medium text-gray-900">{js.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-semibold text-gray-900">
                                                {js.total_vehicles.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${js.total_violations > 10
                                                ? 'bg-red-100 text-red-700'
                                                : js.total_violations > 0
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700'
                                                }`}>
                                                {js.total_violations}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${js.congestion_minutes > 30
                                                ? 'bg-red-100 text-red-700'
                                                : js.congestion_minutes > 10
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700'
                                                }`}>
                                                {js.congestion_minutes} logs
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
