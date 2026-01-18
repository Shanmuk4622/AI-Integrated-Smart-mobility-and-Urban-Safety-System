import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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

    useEffect(() => {
        // Default to Junction 1 for Public View
        const junctionId = 1;

        const fetchInitial = async () => {
            const { data } = await supabase
                .from('traffic_logs')
                .select('*')
                .eq('junction_id', junctionId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();
            if (data) {
                setStats({
                    density: data.vehicle_count,
                    ambulance: false,
                    signal: { action: "GREEN", duration: 30, reason: "Public View" }
                });
            }
        };
        fetchInitial();

        const channel = supabase
            .channel('public-view-traffic')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'traffic_logs', filter: `junction_id=eq.${junctionId}` },
                (payload: any) => {
                    const newLog = payload.new as any;
                    setStats({
                        density: newLog.vehicle_count,
                        ambulance: false,
                        signal: { action: "GREEN", duration: 30, reason: "Live" }
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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
