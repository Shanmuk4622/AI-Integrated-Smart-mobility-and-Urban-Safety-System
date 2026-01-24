import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    APIProvider,
    Map,
    AdvancedMarker,
    InfoWindow,
    useMap,
    useMapsLibrary
} from '@vis.gl/react-google-maps';
import MapLegend from './MapLegend';
import type { Junction } from '../types';
import '../styles/map.css';

interface RoadMapProps {
    junctions: Junction[];
    activeJunctionId: number | null;
    onJunctionSelect: (id: number) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// --- Sub-components to access Map context ---

const MapEffect = ({ activeJunctionId, junctions }: { activeJunctionId: number | null, junctions: Junction[] }) => {
    const map = useMap();

    useEffect(() => {
        if (!map || !activeJunctionId) return;

        const junction = junctions.find(j => j.id === activeJunctionId);
        if (junction) {
            map.panTo({ lat: junction.latitude, lng: junction.longitude });
            map.setZoom(16);
            map.setTilt(45); // cool 3D effect
        }
    }, [map, activeJunctionId, junctions]);

    return null;
};

const TrafficLayer = () => {
    const map = useMap();
    const maps = useMapsLibrary('maps');

    useEffect(() => {
        if (!map || !maps) return;
        const trafficLayer = new maps.TrafficLayer();
        trafficLayer.setMap(map);
        return () => {
            trafficLayer.setMap(null);
        };
    }, [map, maps]);

    return null;
};

// --- Main Component ---

export default function RoadMap({ junctions, activeJunctionId, onJunctionSelect }: RoadMapProps) {
    const [selectedMarker, setSelectedMarker] = useState<Junction | null>(null);

    // Update internal state when activeJunctionId changes from parent
    useEffect(() => {
        if (activeJunctionId) {
            const junction = junctions.find(j => j.id === activeJunctionId);
            if (junction) {
                setSelectedMarker(junction);
            }
        }
    }, [activeJunctionId, junctions]);

    // Default center (VIT-AP)
    const defaultCenter = useMemo(() => {
        if (junctions.length > 0) {
            return { lat: junctions[0].latitude, lng: junctions[0].longitude };
        }
        return { lat: 16.490026, lng: 80.513759 }; // VIT-AP University
    }, [junctions]);

    const handleMarkerClick = useCallback((junction: Junction) => {
        setSelectedMarker(junction);
        onJunctionSelect(junction.id);
    }, [onJunctionSelect]);

    if (!GOOGLE_MAPS_API_KEY) {
        return (
            <div className="map-error">
                <h3>Google Maps API Key Missing</h3>
                <p>Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.</p>
            </div>
        );
    }

    console.log('🗺️ RoadMap rendering with junctions:', junctions);
    console.log('📍 Default center:', defaultCenter);

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
                <Map
                    defaultCenter={defaultCenter}
                    defaultZoom={13}
                    mapId="DEMO_MAP_ID"
                    disableDefaultUI={true}
                    zoomControl={true}
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                    tilt={0}
                    style={{ width: '100%', height: '100%' }}
                >
                    <TrafficLayer />
                    <MapEffect activeJunctionId={activeJunctionId} junctions={junctions} />

                    {junctions.map((junction) => (
                        <AdvancedMarker
                            key={junction.id}
                            position={{ lat: junction.latitude, lng: junction.longitude }}
                            onClick={() => handleMarkerClick(junction)}
                            title={junction.name}
                        >
                            {/* Custom Marker UI - Calculate class based on status/traffic */}
                            <div className={`custom-marker-pin ${junction.status.toLowerCase()} ${junction.status === 'active'
                                ? ((junction as any).vehicle_count > 20 ? 'high' : 'low')
                                : ''
                                } ${activeJunctionId === junction.id ? 'selected' : ''}`}>
                                <div className="marker-core" />
                                <div className="marker-pulse" />
                            </div>
                        </AdvancedMarker>
                    ))}

                    {selectedMarker && (
                        <InfoWindow
                            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
                            onCloseClick={() => setSelectedMarker(null)}
                            headerContent={<div className="info-window-header">{selectedMarker.name}</div>}
                        >
                            <div className="info-window-content">
                                <div className={`status-badge ${selectedMarker.status.toLowerCase()}`}>
                                    {selectedMarker.status}
                                </div>
                                <div className="stats-row">
                                    <span>Signal:</span>
                                    <strong>Red</strong>
                                </div>
                            </div>
                        </InfoWindow>
                    )}
                </Map>
            </APIProvider>

            <MapLegend />
        </div>
    );
}
