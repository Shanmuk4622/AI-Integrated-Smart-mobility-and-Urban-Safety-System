import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface SystemStats {
    activeJunctions: number;
    emergencyVehicles: number;
    totalVehicles: number;
}

export function SystemStatus() {
    const [stats, setStats] = useState<SystemStats>({
        activeJunctions: 0,
        emergencyVehicles: 0,
        totalVehicles: 0
    })

    useEffect(() => {
        async function fetchStats() {
            const [junctions, emergency, traffic] = await Promise.all([
                supabase.from('junctions').select('id').eq('status', 'active'),
                supabase.from('emergency_vehicles').select('id').eq('status', 'active'),
                supabase.from('traffic_logs').select('vehicle_count').limit(100)
            ])

            setStats({
                activeJunctions: junctions.data?.length || 0,
                emergencyVehicles: emergency.data?.length || 0,
                totalVehicles: traffic.data?.reduce((sum, t) => sum + t.vehicle_count, 0) || 0
            })
        }

        fetchStats()
        // Refresh every 5 seconds
        const interval = setInterval(fetchStats, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard
                title="Active Junctions"
                value={stats.activeJunctions}
                icon="🚦"
                color="bg-blue-50"
            />
            <StatCard
                title="Active Emergencies"
                value={stats.emergencyVehicles}
                icon="🚨"
                color="bg-red-50"
                textColor={stats.emergencyVehicles > 0 ? "text-red-600" : "text-gray-900"}
            />
            <StatCard
                title="Traffic Volume (Last 100 Logs)"
                value={stats.totalVehicles}
                icon="🚗"
                color="bg-green-50"
            />
        </div>
    )
}

interface StatCardProps {
    title: string;
    value: number;
    icon: string;
    color: string;
    textColor?: string;
}

function StatCard({ title, value, icon, color, textColor = "text-gray-900" }: StatCardProps) {
    return (
        <div className={`${color} p-4 rounded-lg shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md`}>
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-500">{title}</div>
                <div className="text-xl">{icon}</div>
            </div>
            <div className={`text-3xl font-bold ${textColor}`}>
                {value}
            </div>
        </div>
    )
}
