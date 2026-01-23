import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';
import { divIcon } from 'leaflet';
import { useEffect } from 'react';
import MapLegend from './MapLegend';
import type { Junction } from '../types';

interface RoadMapProps {
    junctions: Junction[];
    activeJunctionId: number | null;
    onJunctionSelect: (id: number) => void;
}

// Helper to Recenter Map with smooth animation
function RecenterMap({ activeJunctionId, junctions }: { activeJunctionId: number | null, junctions: Junction[] }) {
    const map = useMap();
    useEffect(() => {
        if (activeJunctionId) {
            const junction = junctions.find(j => j.id === activeJunctionId);
            if (junction) {
                map.flyTo([junction.latitude, junction.longitude], 15, {
                    duration: 1.5,
                    easeLinearity: 0.25
                });
            }
        }
    }, [activeJunctionId, junctions, map]);
    return null;
}

// Enhanced Custom Marker Icon
const createCustomIcon = (status: string, isActive: boolean) => {
    let statusClass = 'marker-offline';
    if (status === 'active') statusClass = 'marker-active';
    if (status === 'maintenance') statusClass = 'marker-maintenance';

    const pulseClass = isActive ? 'marker-pulse marker-ripple' : '';
    const size = isActive ? 24 : 20;

    return divIcon({
        className: 'custom-marker',
        html: `
            <div class="marker-dot ${statusClass} ${pulseClass}" 
                 style="width: ${size}px; height: ${size}px;">
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
};

// Enhanced Popup Content
const createPopupContent = (junction: Junction, trafficData?: { vehicle_count?: number; congestion_level?: string }) => {
    const statusClass = junction.status.toLowerCase();

    return `
        <div class="scale-in">
            <div class="popup-title">${junction.name}</div>
            <div class="popup-status ${statusClass}">${junction.status}</div>
            ${trafficData ? `
                <div class="popup-stats">
                    <div class="popup-stat">
                        <span class="popup-stat-label">Vehicles:</span>
                        <span class="popup-stat-value">${trafficData.vehicle_count || 0}</span>
                    </div>
                    <div class="popup-stat">
                        <span class="popup-stat-label">Congestion:</span>
                        <span class="popup-stat-value">${trafficData.congestion_level || 'Unknown'}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
};

export default function RoadMap({ junctions, activeJunctionId, onJunctionSelect }: RoadMapProps) {
    // Calculate center based on junctions or use default
    const calculateCenter = (): [number, number] => {
        if (junctions.length === 0) {
            return [40.730610, -73.935242]; // Default: New York
        }

        // If there's an active junction, center on it
        const activeJunction = junctions.find(j => j.id === activeJunctionId);
        if (activeJunction) {
            return [activeJunction.latitude, activeJunction.longitude];
        }

        // Otherwise, center on first junction
        return [junctions[0].latitude, junctions[0].longitude];
    };

    return (
        <div style={{
            height: '100%',
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
            <MapContainer
                center={calculateCenter()}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
                zoomControl={true}
            >
                <RecenterMap activeJunctionId={activeJunctionId} junctions={junctions} />

                {/* Dark Theme Tile Layer */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    maxZoom={19}
                />

                {/* Render Junction Markers */}
                {junctions.map(junction => (
                    <Marker
                        key={junction.id}
                        position={[junction.latitude, junction.longitude]}
                        icon={createCustomIcon(junction.status, activeJunctionId === junction.id)}
                        eventHandlers={{
                            click: () => onJunctionSelect(junction.id),
                        }}
                    >
                        <Popup
                            closeButton={true}
                            className="custom-popup"
                        >
                            <div dangerouslySetInnerHTML={{
                                __html: createPopupContent(junction)
                            }} />
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Floating Legend */}
            <MapLegend />
        </div>
    );
}
