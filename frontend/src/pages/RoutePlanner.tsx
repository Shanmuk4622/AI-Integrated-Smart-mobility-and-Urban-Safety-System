import { useEffect, useState, useCallback } from 'react';
/// <reference types="google.maps" />
import { supabase } from '../lib/supabaseClient';
import {
    APIProvider,
    Map,
    AdvancedMarker,
    useMap,
    useMapsLibrary
} from '@vis.gl/react-google-maps';
import LocationAutocomplete from '../components/LocationAutocomplete';
import type { Junction } from '../types';
import '../styles/map.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// --- Directions Component ---
const Directions = ({
    start,
    end,
    onRouteChanged
}: {
    start: google.maps.LatLngLiteral | null,
    end: google.maps.LatLngLiteral | null,
    onRouteChanged: (route: google.maps.DirectionsResult | null) => void
}) => {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

    // Initialize Service and Renderer
    useEffect(() => {
        if (!routesLibrary || !map) return;

        const service = new routesLibrary.DirectionsService();
        const renderer = new routesLibrary.DirectionsRenderer({
            map,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#0066ff',
                strokeWeight: 6,
                strokeOpacity: 0.8
            }
        });

        setDirectionsService(service);
        setDirectionsRenderer(renderer);

        return () => {
            renderer.setMap(null);
        };
    }, [routesLibrary, map]);

    // Calculate Route
    useEffect(() => {
        if (!directionsService || !directionsRenderer || !start || !end) return;

        directionsService.route({
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true
        }).then(response => {
            directionsRenderer.setDirections(response);
            onRouteChanged(response);
        }).catch(err => {
            console.error("Directions request failed", err);
            onRouteChanged(null);
        });

    }, [directionsService, directionsRenderer, start, end, onRouteChanged]);

    return null;
};

// --- Check Junction Proximity ---
const checkRouteProximity = (junctions: Junction[], route: google.maps.DirectionsResult | null) => {
    if (!route || !route.routes[0] || !route.routes[0].overview_path) return [];

    const path = route.routes[0].overview_path;
    const congestedInPath: Junction[] = [];
    const thresholdMeters = 500;

    junctions.forEach(junction => {
        // Congestion check logic (mocked or real)
        // Assuming junction has congestion_level if extended, but base Junction Type might not.
        // We'll cast to any if needed or extend the type properly in a real app.
        const j = junction as any;
        if (j.congestion_level !== 'High') return;

        const junctionLatLng = new google.maps.LatLng(junction.latitude, junction.longitude);

        let minDistance = Infinity;
        for (const point of path) {
            // computeDistanceBetween requires 'geometry' library
            const dist = google.maps.geometry.spherical.computeDistanceBetween(junctionLatLng, point);
            if (dist < minDistance) minDistance = dist;
        }

        if (minDistance < thresholdMeters) {
            congestedInPath.push(junction);
        }
    });

    return congestedInPath;
};


export default function RoutePlanner() {
    const [startPoint, setStartPoint] = useState<google.maps.LatLngLiteral | null>(null);
    const [endPoint, setEndPoint] = useState<google.maps.LatLngLiteral | null>(null);
    const [startQuery, setStartQuery] = useState("");
    const [endQuery, setEndQuery] = useState("");

    const [junctions, setJunctions] = useState<Junction[]>([]);
    const [congestedJunctionsInPath, setCongestedJunctionsInPath] = useState<Junction[]>([]);

    useEffect(() => {
        const fetchJunctions = async () => {
            const { data: junctionsData } = await supabase.from('junctions').select('*');
            if (junctionsData) {
                const enrichedJunctions = await Promise.all(
                    junctionsData.map(async (j) => {
                        const { data: log } = await supabase
                            .from('traffic_logs')
                            .select('vehicle_count, congestion_level')
                            .eq('junction_id', j.id)
                            .order('timestamp', { ascending: false })
                            .limit(1)
                            .single();
                        return { ...j, vehicle_count: log?.vehicle_count || 0, congestion_level: log?.congestion_level || 'Low' };
                    })
                );
                console.log('🗺️ RoutePlanner junctions:', enrichedJunctions);
                setJunctions(enrichedJunctions);
            }
        };
        fetchJunctions();
    }, []);

    const handleRouteChanged = useCallback((route: google.maps.DirectionsResult | null) => {
        if (!route) {
            setCongestedJunctionsInPath([]);
            return;
        }

        // Ensure geometry library is loaded
        if (google.maps.geometry) {
            const congested = checkRouteProximity(junctions, route);
            setCongestedJunctionsInPath(congested);
        }
    }, [junctions]);

    if (!GOOGLE_MAPS_API_KEY) return <div className="map-error">Missing Google Maps API Key</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px', background: '#222', color: 'white', display: 'flex', gap: '20px', zIndex: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '0.8em', color: '#aaa' }}>From:</span>
                    <LocationAutocomplete
                        value={startQuery}
                        onChange={setStartQuery}
                        onSelect={(lat, lon) => setStartPoint({ lat, lng: lon })}
                        placeholder="Start Location"
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontSize: '0.8em', color: '#aaa' }}>To:</span>
                    <LocationAutocomplete
                        value={endQuery}
                        onChange={setEndQuery}
                        onSelect={(lat, lon) => setEndPoint({ lat, lng: lon })}
                        placeholder="Destination"
                    />
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    Status: <span style={{ color: congestedJunctionsInPath.length > 0 ? '#ff4444' : '#00ff88', fontWeight: 'bold' }}>
                        {congestedJunctionsInPath.length > 0 ? `Congestion Detected (${congestedJunctionsInPath.length})` : 'Clear'}
                    </span>
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'routes', 'geometry', 'marker']}>
                    <Map
                        defaultCenter={{ lat: 16.490026, lng: 80.513759 }}
                        defaultZoom={15}
                        mapId="ROUTE_PLANNER_MAP"
                        disableDefaultUI={false}
                    >
                        <Directions start={startPoint} end={endPoint} onRouteChanged={handleRouteChanged} />

                        {junctions.map(j => (
                            <AdvancedMarker
                                key={j.id}
                                position={{ lat: j.latitude, lng: j.longitude }}
                                title={j.name}
                            >
                                <div className={`custom-marker-pin ${j.status.toLowerCase()} ${j.status === 'active'
                                    ? ((j as any).vehicle_count > 20 ? 'high' : 'low')
                                    : ''
                                    }`}>
                                    <div className="marker-core" />
                                    <div className="marker-pulse" />
                                </div>
                            </AdvancedMarker>
                        ))}
                    </Map>
                </APIProvider>
            </div>
        </div>
    );
}
