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
const TRAFFIC_DATA_VALIDITY_MINUTES = 5;

// --- Multi-Route Directions Component ---
const MultiRouteDirections = ({
    start,
    end,
    onRoutesChanged,
    rerouteKey,
    junctions
}: {
    start: google.maps.LatLngLiteral | null,
    end: google.maps.LatLngLiteral | null,
    onRoutesChanged: (routes: google.maps.DirectionsResult | null) => void,
    rerouteKey?: number,
    junctions: Junction[]
}) => {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
    const [renderers, setRenderers] = useState<google.maps.DirectionsRenderer[]>([]);

    // Initialize service
    useEffect(() => {
        if (!routesLibrary) return;
        setDirectionsService(new routesLibrary.DirectionsService());
    }, [routesLibrary]);

    // Calculate and display multiple routes
    useEffect(() => {
        if (!directionsService || !map || !start || !end) return;

        // Clear old renderers
        renderers.forEach(r => r.setMap(null));
        setRenderers([]);

        console.log('🗺️ Requesting alternative routes...');

        // Request routes with alternatives enabled
        directionsService.route({
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,  // Request up to 3 alternative routes
            optimizeWaypoints: false
        }).then(response => {
            const routes = response.routes;
            console.log(`✅ Found ${routes.length} route(s)`);

            if (routes.length === 0) {
                console.error('❌ No routes found');
                onRoutesChanged(null);
                return;
            }

            onRoutesChanged(response);

            // Analyze each route for congestion
            const routeAnalysis = routes.map((route, idx) => {
                const path = route.overview_path;
                let congestedJunctions = 0;

                // Check if route passes near congested junctions
                junctions.forEach(junction => {
                    const j = junction as any;
                    if (j.status !== 'active' || j.congestion_level !== 'High') return;

                    const junctionPos = new google.maps.LatLng(junction.latitude, junction.longitude);

                    for (const point of path) {
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(junctionPos, point);
                        if (distance < 500) { // Within 500m
                            congestedJunctions++;
                            break;
                        }
                    }
                });

                return {
                    index: idx,
                    congestion: congestedJunctions,
                    duration: route.legs[0].duration?.value || 0,
                    distance: route.legs[0].distance?.value || 0
                };
            });

            // Sort: prefer routes with NO congestion, then by duration
            routeAnalysis.sort((a, b) => {
                if (a.congestion !== b.congestion) return a.congestion - b.congestion;
                return a.duration - b.duration;
            });

            const bestRouteIndex = routeAnalysis[0].index;

            console.log('📊 Route Analysis:', routeAnalysis.map(r => ({
                route: r.index + 1,
                congestion: r.congestion + ' junctions',
                duration: Math.round(r.duration / 60) + ' min',
                recommended: r.index === bestRouteIndex ? '✅' : ''
            })));

            // Create renderer for each route
            const newRenderers = routes.map((route, idx) => {
                const isBest = idx === bestRouteIndex;
                const analysis = routeAnalysis.find(r => r.index === idx)!;
                const hasCongestion = analysis.congestion > 0;

                return new routesLibrary!.DirectionsRenderer({
                    map,
                    directions: { ...response, routes: [route] },
                    routeIndex: 0,
                    suppressMarkers: !isBest, // Only show markers on best route
                    polylineOptions: {
                        strokeColor: isBest
                            ? '#00ff88'  // Green = Best route
                            : hasCongestion
                                ? '#ff4444'  // Red = Has congestion
                                : '#888888', // Grey = Alternative
                        strokeWeight: isBest ? 7 : 4,
                        strokeOpacity: isBest ? 1.0 : 0.6,
                        zIndex: isBest ? 100 : 50
                    }
                });
            });

            setRenderers(newRenderers);

        }).catch(err => {
            console.error('❌ Route calculation failed:', err);
            onRoutesChanged(null);
        });

        return () => {
            renderers.forEach(r => r.setMap(null));
        };
    }, [directionsService, map, start, end, rerouteKey, junctions]);

    return null;
};

// Check route proximity
const checkRouteProximity = (junctions: Junction[], route: google.maps.DirectionsResult | null) => {
    if (!route || !route.routes[0]) return [];

    const path = route.routes[0].overview_path;
    const congested: Junction[] = [];

    junctions.forEach(junction => {
        const j = junction as any;
        if (j.status !== 'active' || j.congestion_level !== 'High') return;

        const jPos = new google.maps.LatLng(junction.latitude, junction.longitude);

        for (const point of path) {
            const dist = google.maps.geometry.spherical.computeDistanceBetween(jPos, point);
            if (dist < 500) {
                congested.push(junction);
                break;
            }
        }
    });

    return congested;
};

export default function RoutePlanner() {
    const [startPoint, setStartPoint] = useState<google.maps.LatLngLiteral | null>(null);
    const [endPoint, setEndPoint] = useState<google.maps.LatLngLiteral | null>(null);
    const [startQuery, setStartQuery] = useState("");
    const [endQuery, setEndQuery] = useState("");
    const [junctions, setJunctions] = useState<Junction[]>([]);
    const [congestedInPath, setCongestedInPath] = useState<Junction[]>([]);
    const [rerouteKey, setRerouteKey] = useState(0);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [isRerouting, setIsRerouting] = useState(false);
    const [routeInfo, setRouteInfo] = useState<{
        distance: string;
        duration: string;
        congestionCount: number;
    } | null>(null);

    const fetchJunctions = useCallback(async () => {
        const { data } = await supabase.from('junctions').select('*');
        if (!data) return;

        const cutoff = new Date(Date.now() - TRAFFIC_DATA_VALIDITY_MINUTES * 60 * 1000).toISOString();

        const enriched = await Promise.all(
            data.map(async (j) => {
                const { data: log } = await supabase
                    .from('traffic_logs')
                    .select('vehicle_count, congestion_level, timestamp')
                    .eq('junction_id', j.id)
                    .gte('timestamp', cutoff)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                return {
                    ...j,
                    vehicle_count: log?.vehicle_count || 0,
                    congestion_level: log?.congestion_level || 'Low'
                };
            })
        );

        setJunctions(enriched);
        setLastUpdate(new Date());
    }, []);

    useEffect(() => {
        fetchJunctions();

        const interval = setInterval(fetchJunctions, 10000);

        const channel = supabase
            .channel('route-traffic')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'traffic_logs' },
                (payload: any) => {
                    const log = payload.new;
                    console.log('📊 Real-time traffic update:', {
                        junction: log.junction_id,
                        vehicles: log.vehicle_count,
                        congestion: log.congestion_level
                    });

                    // Update junction state immediately
                    setJunctions(prev => {
                        const updated = prev.map(j =>
                            j.id === log.junction_id
                                ? { ...j, vehicle_count: log.vehicle_count, congestion_level: log.congestion_level }
                                : j
                        );

                        // Check if this affects current route
                        if (log.congestion_level === 'High' && startPoint && endPoint) {
                            const affectedJunction = updated.find(j => j.id === log.junction_id);
                            if (affectedJunction) {
                                console.log(`⚠️ HIGH CONGESTION at ${affectedJunction.name}!`);
                                console.log('🔄 Triggering automatic reroute...');

                                // Show rerouting notification
                                setIsRerouting(true);

                                // Trigger reroute IMMEDIATELY
                                setRerouteKey(k => k + 1);

                                // Hide notification after 2 seconds
                                setTimeout(() => setIsRerouting(false), 2000);
                            }
                        }

                        return updated;
                    });
                }
            )
            .subscribe((status) => {
                console.log('📡 Real-time subscription status:', status);
            });

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [fetchJunctions, startPoint, endPoint]);

    const handleRoutesChanged = useCallback((result: google.maps.DirectionsResult | null) => {
        if (!result) {
            setCongestedInPath([]);
            setRouteInfo(null);
            return;
        }

        if (google.maps.geometry) {
            const congested = checkRouteProximity(junctions, result);
            setCongestedInPath(congested);
        }

        // Extract route info from the best route (first route)
        const bestRoute = result.routes[0];
        if (bestRoute && bestRoute.legs[0]) {
            const leg = bestRoute.legs[0];
            setRouteInfo({
                distance: leg.distance?.text || 'N/A',
                duration: leg.duration?.text || 'N/A',
                congestionCount: checkRouteProximity(junctions, result).length
            });
        }
    }, [junctions]);

    if (!GOOGLE_MAPS_API_KEY) return <div>Missing API Key</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px', background: '#1a1a1a', color: 'white', display: 'flex', gap: '20px', borderBottom: '2px solid #333' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75em', color: '#888', marginBottom: '4px' }}>From:</div>
                    <LocationAutocomplete
                        value={startQuery}
                        onChange={setStartQuery}
                        onSelect={(lat, lon) => setStartPoint({ lat, lng: lon })}
                        placeholder="Start Location"
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75em', color: '#888', marginBottom: '4px' }}>To:</div>
                    <LocationAutocomplete
                        value={endQuery}
                        onChange={setEndQuery}
                        onSelect={(lat, lon) => setEndPoint({ lat, lng: lon })}
                        placeholder="Destination"
                    />
                </div>
                <div style={{ minWidth: '200px', textAlign: 'right' }}>
                    <div style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '4px' }}>
                        {congestedInPath.length > 0 ? (
                            <span style={{ color: '#ff4444' }}>⚠️ Congestion ({congestedInPath.length})</span>
                        ) : (
                            <span style={{ color: '#00ff88' }}>✅ Clear</span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.7em', color: '#666' }}>
                        Updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                {/* Rerouting Notification */}
                {isRerouting && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#ff4444',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        animation: 'pulse 1s infinite'
                    }}>
                        🔄 Congestion Detected! Recalculating Routes...
                    </div>
                )}

                {/* Floating Route Info Window */}
                {routeInfo && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'rgba(26, 26, 26, 0.95)',
                        backdropFilter: 'blur(10px)',
                        color: 'white',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        zIndex: 1000,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        minWidth: '220px'
                    }}>
                        <div style={{
                            fontSize: '0.85em',
                            color: '#888',
                            marginBottom: '12px',
                            fontWeight: '600',
                            letterSpacing: '0.5px'
                        }}>
                            📍 ROUTE INFO
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{
                                fontSize: '0.75em',
                                color: '#666',
                                marginBottom: '4px'
                            }}>
                                Distance
                            </div>
                            <div style={{
                                fontSize: '1.2em',
                                fontWeight: 'bold',
                                color: '#00ff88'
                            }}>
                                {routeInfo.distance}
                            </div>
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <div style={{
                                fontSize: '0.75em',
                                color: '#666',
                                marginBottom: '4px'
                            }}>
                                Duration
                            </div>
                            <div style={{
                                fontSize: '1.2em',
                                fontWeight: 'bold',
                                color: '#00ff88'
                            }}>
                                {routeInfo.duration}
                            </div>
                        </div>

                        <div style={{
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            paddingTop: '10px',
                            marginTop: '10px'
                        }}>
                            <div style={{
                                fontSize: '0.75em',
                                color: '#666',
                                marginBottom: '4px'
                            }}>
                                Status
                            </div>
                            <div style={{
                                fontSize: '0.9em',
                                fontWeight: 'bold',
                                color: routeInfo.congestionCount > 0 ? '#ff4444' : '#00ff88'
                            }}>
                                {routeInfo.congestionCount > 0
                                    ? `⚠️ ${routeInfo.congestionCount} Congested Area${routeInfo.congestionCount > 1 ? 's' : ''}`
                                    : '✅ Clear Route'
                                }
                            </div>
                        </div>
                    </div>
                )}

                <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'routes', 'geometry', 'marker']}>
                    <Map
                        defaultCenter={{ lat: 16.490026, lng: 80.513759 }}
                        defaultZoom={14}
                        mapId="ROUTE_PLANNER_MAP"
                        disableDefaultUI={false}
                    >
                        <MultiRouteDirections
                            start={startPoint}
                            end={endPoint}
                            onRoutesChanged={handleRoutesChanged}
                            rerouteKey={rerouteKey}
                            junctions={junctions}
                        />

                        {junctions.map(j => {
                            const isActive = j.status === 'active';
                            const vehicles = (j as any).vehicle_count || 0;
                            const trafficClass = isActive ? (vehicles > 20 ? 'high' : 'low') : '';

                            return (
                                <AdvancedMarker
                                    key={`${j.id}-${vehicles}-${j.status}`}
                                    position={{ lat: j.latitude, lng: j.longitude }}
                                    title={`${j.name}\n${j.status}\n${vehicles} vehicles`}
                                >
                                    <div className={`custom-marker-pin ${j.status.toLowerCase()} ${trafficClass}`}>
                                        <div className="marker-core" />
                                        <div className="marker-pulse" />
                                    </div>
                                </AdvancedMarker>
                            );
                        })}
                    </Map>
                </APIProvider>

                {/* Route Legend */}
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '12px',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.85em'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Route Legend:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '30px', height: '4px', background: '#00ff88' }}></div>
                        <span>Recommended (Avoids Congestion)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '30px', height: '4px', background: '#ff4444' }}></div>
                        <span>Has Congestion</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '4px', background: '#888888' }}></div>
                        <span>Alternative Route</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
