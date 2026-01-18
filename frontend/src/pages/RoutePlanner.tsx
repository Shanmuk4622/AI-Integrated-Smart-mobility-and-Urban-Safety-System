
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import LocationAutocomplete from '../components/LocationAutocomplete';

// Fixing default icon issue in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- Interfaces ---
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

interface Junction {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
}

interface JunctionWithCongestion extends Junction {
    congestion_level?: string;
    vehicle_count?: number;
}

// Detour node for rerouting (can be calculated dynamically in future)
const DETOUR_NODE = L.latLng(51.5115, -0.1044); // Blackfriars Bridge (North Bank)

// --- Utility Functions for Route-Junction Proximity Detection ---
const getDistanceToSegment = (point: L.LatLng, lineStart: L.LatLng, lineEnd: L.LatLng): number => {
    const x = point.lat;
    const y = point.lng;
    const x1 = lineStart.lat;
    const y1 = lineStart.lng;
    const x2 = lineEnd.lat;
    const y2 = lineEnd.lng;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    // Convert to meters (approximate: 1 degree ≈ 111.32 km)
    const distanceInDegrees = Math.sqrt(dx * dx + dy * dy);
    return distanceInDegrees * 111320;
};

const isJunctionInRoutePath = (
    junction: JunctionWithCongestion,
    routeCoords: L.LatLng[],
    thresholdMeters: number = 500
): boolean => {
    if (!junction.latitude || !junction.longitude || routeCoords.length === 0) {
        return false;
    }

    const junctionPoint = L.latLng(junction.latitude, junction.longitude);

    // Check if junction is within threshold distance of any route segment
    for (let i = 0; i < routeCoords.length - 1; i++) {
        const distance = getDistanceToSegment(junctionPoint, routeCoords[i], routeCoords[i + 1]);

        if (distance <= thresholdMeters) {
            return true;
        }
    }

    return false;
};

// --- Routing Control Component (Memoized) ---
const Routing = React.memo(({ start, end, avoidPoint, onRouteCalculated }: {
    start: L.LatLng,
    end: L.LatLng,
    avoidPoint: L.LatLng | null,
    onRouteCalculated?: (coordinates: L.LatLng[]) => void
}) => {
    const map = useMap();
    const routingControlRef = useRef<any>(null);
    const labelMarkersRef = useRef<L.Marker[]>([]); // Track label markers

    useEffect(() => {
        if (!map) return;

        // Cleanup previous control
        if (routingControlRef.current) {
            try {
                map.removeControl(routingControlRef.current);
                routingControlRef.current = null;
            } catch (e) {
                console.warn("Control cleaning warning", e);
            }
        }

        // Cleanup previous labels
        labelMarkersRef.current.forEach(m => m.remove());
        labelMarkersRef.current = [];

        const waypoints = [start];
        const isAvoiding = !!avoidPoint;

        if (isAvoiding) {
            waypoints.push(DETOUR_NODE);
        }

        waypoints.push(end);

        const router = new (L as any).Routing.OSRMv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            requestParameters: {
                alternatives: true,
                steps: true
            }
        });

        const routingControl = (L as any).Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            showAlternatives: !isAvoiding,
            fitSelectedRoutes: true,
            lineOptions: {
                styles: [{ color: isAvoiding ? '#ff4444' : '#0066ff', opacity: 0.8, weight: 6 }]
            },
            altLineOptions: {
                styles: [
                    { color: 'black', opacity: 0.15, weight: 9 }, // Shadow
                    { color: 'white', opacity: 0.8, weight: 6 },  // Outline
                    { color: '#BEBEBE', opacity: 1, weight: 4 }   // Main Grey
                ]
            },
            createMarker: function () { return null; },
            router: router
        }).addTo(map);

        // --- Custom Labels Logic ---
        routingControl.on('routesfound', function (e: any) {
            // Clear old labels first
            labelMarkersRef.current.forEach(m => m.remove());
            labelMarkersRef.current = [];

            const routes = e.routes;

            // Extract and pass primary route coordinates to parent component
            if (routes.length > 0 && onRouteCalculated) {
                const primaryRoute = routes[0];
                onRouteCalculated(primaryRoute.coordinates);
            }

            routes.forEach((route: any) => {
                const summary = route.summary;
                if (!summary) return;

                const timeMin = Math.round(summary.totalTime / 60);
                const distKm = (summary.totalDistance / 1000).toFixed(1);

                // Calculate display content (distance + time)
                const html = `
                    <div style="font-size:12px; color:#222; font-weight:bold;">${timeMin} min</div>
                    <div style="font-size:10px; color:#666;">${distKm} km</div>
                `;

                // Find midpoint for label
                const coordinates = route.coordinates;
                const midIndex = Math.floor(coordinates.length / 2); // Simple midpoint
                const midPoint = coordinates[midIndex];

                if (midPoint) {
                    const label = L.marker(midPoint, {
                        icon: L.divIcon({
                            className: 'route-label', // defined in App.css
                            html: html,
                            iconSize: [60, 30],
                            iconAnchor: [30, 30]
                        }),
                        zIndexOffset: 1000
                    }).addTo(map);

                    labelMarkersRef.current.push(label);
                }
            });
        });

        routingControlRef.current = routingControl;

        return () => {
            if (map && routingControlRef.current) {
                try {
                    map.removeControl(routingControlRef.current);
                } catch (e) { }
            }
            // Cleanup labels on unmount/re-render
            labelMarkersRef.current.forEach(m => m.remove());
            labelMarkersRef.current = [];
        };
    }, [map, start.lat, start.lng, end.lat, end.lng, !!avoidPoint]);

    return null;
}, (prev, next) => {
    const startSame = prev.start.lat === next.start.lat && prev.start.lng === next.start.lng;
    const endSame = prev.end.lat === next.end.lat && prev.end.lng === next.end.lng;
    const avoidSame = (prev.avoidPoint === null && next.avoidPoint === null) ||
        (prev.avoidPoint !== null && next.avoidPoint !== null && prev.avoidPoint.lat === next.avoidPoint.lat);

    return startSame && endSame && avoidSame;
});


export default function RoutePlanner() {
    const [stats, setStats] = useState<StreamStats | null>(null);
    const [junctions, setJunctions] = useState<Junction[]>([]);
    const [selectedJunction, setSelectedJunction] = useState<Junction | null>(null);

    // New state for intelligent routing
    const [junctionsWithCongestion, setJunctionsWithCongestion] = useState<JunctionWithCongestion[]>([]);
    const [routeCoordinates, setRouteCoordinates] = useState<L.LatLng[]>([]);
    const [congestedJunctionsInPath, setCongestedJunctionsInPath] = useState<JunctionWithCongestion[]>([]);

    // State for Dynamic Points
    const [startPoint, setStartPoint] = useState<L.LatLng>(L.latLng(51.500, -0.10));
    const [endPoint, setEndPoint] = useState<L.LatLng>(L.latLng(51.510, -0.08));

    // Input States
    const [startQuery, setStartQuery] = useState("Big Ben, London");
    const [endQuery, setEndQuery] = useState("Tower of London");

    useEffect(() => {
        // Subscribe to changes in traffic logs for the SELECTED junction
        if (!selectedJunction) return;

        const junctionId = selectedJunction.id;

        // Fetch initial state
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
                    ambulance: false, // Traffic logs might not have this, simplified
                    signal: { action: "GREEN", duration: 30, reason: "Initial" } // default
                });
            }
        };

        fetchInitial();

        const channel = supabase
            .channel('route-planner-traffic')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'traffic_logs', filter: `junction_id=eq.${junctionId}` },
                (payload) => {
                    const newLog = payload.new as any;
                    setStats({
                        density: newLog.vehicle_count,
                        ambulance: false, // You might want to update schema to include this in traffic_logs if crucial
                        signal: { action: "GREEN", duration: 30, reason: "Live Update" }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedJunction]);

    // Fetch junctions with congestion data from database
    useEffect(() => {
        const fetchJunctionsWithCongestion = async () => {
            // Fetch all junctions
            const { data: junctionsData, error: junctionsError } = await supabase
                .from('junctions')
                .select('*')
                .order('id');

            if (junctionsError) {
                console.error('Error fetching junctions:', junctionsError);
                return;
            }

            if (!junctionsData) return;

            // Fetch latest traffic log for each junction
            const junctionsWithCongestionData = await Promise.all(
                junctionsData.map(async (junction) => {
                    const { data: trafficLog } = await supabase
                        .from('traffic_logs')
                        .select('congestion_level, vehicle_count')
                        .eq('junction_id', junction.id)
                        .order('timestamp', { ascending: false })
                        .limit(1)
                        .single();

                    return {
                        ...junction,
                        congestion_level: trafficLog?.congestion_level || 'Low',
                        vehicle_count: trafficLog?.vehicle_count || 0
                    };
                })
            );

            setJunctions(junctionsData);
            setJunctionsWithCongestion(junctionsWithCongestionData);
        };

        fetchJunctionsWithCongestion();

        // Subscribe to traffic log updates for ALL junctions
        const trafficChannel = supabase
            .channel('route-planner-all-traffic')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'traffic_logs' },
                () => {
                    fetchJunctionsWithCongestion(); // Reload when any traffic log updates
                }
            )
            .subscribe();

        // Subscribe to junction updates
        const junctionChannel = supabase
            .channel('route-planner-junctions')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'junctions' },
                () => {
                    fetchJunctionsWithCongestion(); // Reload when junctions change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(trafficChannel);
            supabase.removeChannel(junctionChannel);
        };
    }, []);

    // Auto-select first active junction when junctions load
    useEffect(() => {
        if (junctions.length > 0 && !selectedJunction) {
            const activeJunction = junctions.find(j => j.status === 'active' && j.latitude && j.longitude);
            setSelectedJunction(activeJunction || junctions[0]);
        }
    }, [junctions, selectedJunction]);

    // Detect congested junctions in the route path
    useEffect(() => {
        if (routeCoordinates.length === 0 || junctionsWithCongestion.length === 0) {
            setCongestedJunctionsInPath([]);
            return;
        }

        const congestedInPath = junctionsWithCongestion.filter(junction => {
            const isHighCongestion = junction.congestion_level === 'High';
            const isInPath = isJunctionInRoutePath(junction, routeCoordinates, 500); // 500m threshold

            return isHighCongestion && isInPath;
        });

        setCongestedJunctionsInPath(congestedInPath);
    }, [routeCoordinates, junctionsWithCongestion]);


    // Intelligent rerouting: only reroute if high-congestion junctions are IN the route path
    const shouldReroute = congestedJunctionsInPath.length > 0;
    const avoidNode = shouldReroute && congestedJunctionsInPath[0]
        ? L.latLng(congestedJunctionsInPath[0].latitude!, congestedJunctionsInPath[0].longitude!)
        : null;


    // --- Geocoding Handlers ---
    const handleStartSelect = (lat: number, lon: number, displayName: string) => {
        setStartPoint(L.latLng(lat, lon));
        setStartQuery(displayName);
    };

    const handleEndSelect = (lat: number, lon: number, displayName: string) => {
        setEndPoint(L.latLng(lat, lon));
        setEndQuery(displayName);
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Control Panel */}
            <div style={{
                padding: '15px',
                background: '#222',
                color: 'white',
                borderBottom: '1px solid #444',
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
                flexWrap: 'wrap',
                zIndex: 2000
            }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ fontSize: '0.8em', color: '#aaa' }}>From:</span>
                        <LocationAutocomplete
                            value={startQuery}
                            onChange={setStartQuery}
                            onSelect={handleStartSelect}
                            placeholder="Start Location"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ fontSize: '0.8em', color: '#aaa' }}>To:</span>
                        <LocationAutocomplete
                            value={endQuery}
                            onChange={setEndQuery}
                            onSelect={handleEndSelect}
                            placeholder="Destination"
                        />
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '0.9em' }}>
                    Status:
                    <span style={{
                        marginLeft: '5px',
                        color: shouldReroute ? '#ff4444' : '#44ff44',
                        fontWeight: 'bold'
                    }}>
                        {shouldReroute
                            ? `REROUTING (${congestedJunctionsInPath.length} congested junction${congestedJunctionsInPath.length > 1 ? 's' : ''} in path)`
                            : "OPTIMAL"}
                    </span>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    center={selectedJunction && selectedJunction.latitude && selectedJunction.longitude
                        ? [selectedJunction.latitude, selectedJunction.longitude]
                        : [51.505, -0.09]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* The Monitored Junction - Uses REAL junction from database */}
                    {selectedJunction && selectedJunction.latitude && selectedJunction.longitude && (
                        <Circle
                            center={[selectedJunction.latitude, selectedJunction.longitude]}
                            radius={300}
                            pathOptions={{
                                color: shouldReroute ? 'red' : 'green',
                                fillColor: shouldReroute ? 'red' : 'green',
                                fillOpacity: 0.2
                            }}
                        >
                            <Popup>
                                <strong>{selectedJunction.name}</strong><br />
                                Status: {shouldReroute ? 'CONGESTED (IN PATH)' : 'NORMAL'}<br />
                                Vehicles: {stats?.density || 0}
                            </Popup>
                        </Circle>
                    )}

                    <Marker position={startPoint}><Popup>Start: {startQuery}</Popup></Marker>
                    <Marker position={endPoint}><Popup>Destination: {endQuery}</Popup></Marker>

                    {/* Junction Markers */}
                    {junctionsWithCongestion.map(junction => {
                        if (!junction.latitude || !junction.longitude) return null;

                        // Determine if this junction is congested and in the route path
                        const isCongestedInPath = congestedJunctionsInPath.some(cj => cj.id === junction.id);
                        const isHighCongestion = junction.congestion_level === 'High';

                        // Color coding:
                        // Red: Congested and in path (causing rerouting)
                        // Orange: Congested but not in path
                        // Green: Normal/Low congestion
                        const markerColor = isCongestedInPath
                            ? '#ff0000' // Red: Congested and in path
                            : isHighCongestion
                                ? '#ff8800' // Orange: Congested but not in path
                                : junction.status === 'active' ? '#28a745' : '#777'; // Green: Normal

                        const junctionIcon = L.divIcon({
                            className: 'custom-icon',
                            html: `<div style="
                                background-color: ${markerColor};
                                width: 16px;
                                height: 16px;
                                border-radius: 50%;
                                border: 2px solid white;
                                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                            "></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });

                        return (
                            <Marker
                                key={junction.id}
                                position={[junction.latitude, junction.longitude]}
                                icon={junctionIcon}
                            >
                                <Popup>
                                    <strong>{junction.name} (ID: {junction.id})</strong><br />
                                    Status: {junction.status.toUpperCase()}<br />
                                    Congestion: {junction.congestion_level || 'Unknown'}<br />
                                    Vehicles: {junction.vehicle_count || 0}
                                    {isCongestedInPath && <><br /><strong style={{ color: 'red' }}>⚠️ IN ROUTE PATH</strong></>}
                                </Popup>
                            </Marker>
                        );
                    })}

                    {/* Routing Logic */}
                    <Routing
                        start={startPoint}
                        end={endPoint}
                        avoidPoint={avoidNode}
                        onRouteCalculated={setRouteCoordinates}
                    />

                </MapContainer>
            </div>
        </div>
    );
}
