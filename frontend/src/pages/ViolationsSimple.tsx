import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SystemStatus } from '../components/SystemStatus'

interface Junction {
    name: string;
}

interface Violation {
    id: number;
    violation_type: string;
    timestamp: string;
    status: string;
    confidence_score?: number;
    vehicle_speed?: number;
    license_plate?: string;
    image_url?: string;
    junction_id: number;
    junctions?: Junction;
}

export default function ViolationsSimple() {
    const [violations, setViolations] = useState<Violation[]>([])
    const [loading, setLoading] = useState(true)

    async function fetchViolations() {
        setLoading(true)
        const { data } = await supabase
            .from('violations')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50)

        setViolations(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchViolations()

        // Subscribe to new violations in real-time
        const channel = supabase
            .channel('violations-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'violations'
            }, (payload: any) => {
                console.log('New violation!', payload)
                fetchViolations() // Refresh list
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <button
                    onClick={fetchViolations}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Refresh Data
                </button>
            </div>

            {/* System Status Widget */}
            <SystemStatus />

            <h2 className="text-xl font-bold mb-4 mt-8">Recent Violations</h2>

            {loading ? (
                <div className="text-center py-10">Loading violations...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {violations.map((v) => (
                        <div key={v.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                            {/* Evidence Image */}
                            <div className="h-48 bg-gray-200 relative">
                                {v.image_url ? (
                                    <img
                                        src={v.image_url}
                                        alt={v.violation_type}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400 bg-gray-100">
                                        No Image Evidence
                                    </div>
                                )}

                                {/* Confidence Badge */}
                                {v.confidence_score && (
                                    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                        {Math.round(v.confidence_score * 100)}% Confidence
                                    </div>
                                )}
                            </div>

                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-lg text-red-600">{v.violation_type}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${v.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        v.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {v.status?.toUpperCase() || 'PENDING'}
                                    </span>
                                </div>

                                <div className="text-sm text-gray-600 space-y-1 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span>📍</span> {v.junctions?.name || `Junction ${v.junction_id}`}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>🕒</span> {new Date(v.timestamp).toLocaleString()}
                                    </div>
                                    {v.vehicle_speed && (
                                        <div className="flex items-center gap-2 font-medium text-blue-600">
                                            <span>💨</span> {Math.round(v.vehicle_speed)} km/h
                                        </div>
                                    )}
                                    {v.license_plate && (
                                        <div className="flex items-center gap-2 font-mono bg-gray-100 px-2 py-1 rounded w-fit">
                                            <span>🔢</span> {v.license_plate}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-sm font-medium">
                                        Review
                                    </button>
                                    <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded text-sm font-medium">
                                        Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {violations.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
                            No violations detected yet.
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
