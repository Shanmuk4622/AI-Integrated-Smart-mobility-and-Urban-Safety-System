import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { useEffect } from 'react';

interface Junction {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
}

interface RoadMapProps {
    junctions: Junction[];
    activeJunctionId: number | null;
    onJunctionSelect: (id: number) => void;
}

// Helper to Recenter Map
function RecenterMap({ activeJunctionId, junctions }: { activeJunctionId: number | null, junctions: Junction[] }) {
    const map = useMap();
    useEffect(() => {
        if (activeJunctionId) {
            const junction = junctions.find(j => j.id === activeJunctionId);
            if (junction) {
                map.setView([junction.latitude, junction.longitude], 14, { animate: true });
            }
        }
    }, [activeJunctionId, junctions, map]);
    return null;
}

// Custom Icons
const createIcon = (status: string, isActive: boolean) => {
    let color = '#777'; // default (offline)
    if (status === 'active') color = '#28a745'; // green
    if (status === 'maintenance') color = '#ffc107'; // yellow

    // Pulse effect for active
    const pulseClass = isActive ? 'map-marker-pulse' : '';

    return divIcon({
        className: 'custom-icon',
        html: `<div style="
            background-color: ${color};
            width: ${isActive ? '24px' : '16px'};
            height: ${isActive ? '24px' : '16px'};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        " class="${pulseClass}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

export default function RoadMap({ junctions, activeJunctionId, onJunctionSelect }: RoadMapProps) {
    // Default center (New York)
    const defaultCenter: [number, number] = [40.730610, -73.935242];

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '10px', overflow: 'hidden' }}>
            <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <RecenterMap activeJunctionId={activeJunctionId} junctions={junctions} />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {junctions.map(j => {
                    return (
                        <Marker
                            key={j.id}
                            position={[j.latitude, j.longitude]}
                            icon={createIcon(j.status, activeJunctionId === j.id)}
                            eventHandlers={{
                                click: () => onJunctionSelect(j.id),
                            }}
                        >
                            <Popup>
                                <strong>{j.name} (ID: {j.id})</strong><br />
                                Status: {j.status.toUpperCase()}
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    );
}
