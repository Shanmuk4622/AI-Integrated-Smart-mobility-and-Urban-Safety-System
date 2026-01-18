
import React, { useEffect, useState, useRef } from 'react';
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

// --- Constants (Moved outside to prevent re-creation) ---
const CENTER_NODE = L.latLng(51.505, -0.09); // "The Junction"
const DETOUR_NODE = L.latLng(51.5115, -0.1044); // Blackfriars Bridge (North Bank)

// --- Routing Control Component (Memoized) ---
const Routing = React.memo(({ start, end, avoidPoint }: { start: L.LatLng, end: L.LatLng, avoidPoint: L.LatLng | null }) => {
    const map = useMap();
    const routingControlRef = useRef<any>(null);

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
                alternatives: true, // Explicitly ask API for alternatives
                steps: true
            }
        });

        const routingControl = (L as any).Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            // Only show alternatives when we are NOT avoiding traffic.
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
            createMarker: function () { return null; }, // Hide default markers
            router: router
        }).addTo(map);

        routingControlRef.current = routingControl;

        return () => {
            if (map && routingControlRef.current) {
                try {
                    map.removeControl(routingControlRef.current);
                } catch (e) { }
            }
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
    const ws = useRef<WebSocket | null>(null);

    // State for Dynamic Points
    const [startPoint, setStartPoint] = useState<L.LatLng>(L.latLng(51.500, -0.10));
    const [endPoint, setEndPoint] = useState<L.LatLng>(L.latLng(51.510, -0.08));

    // Input States
    const [startQuery, setStartQuery] = useState("Big Ben, London");
    const [endQuery, setEndQuery] = useState("Tower of London");

    useEffect(() => {
        ws.current = new WebSocket('ws://localhost:8000/ws/stream');
        ws.current.onmessage = (event) => {
            if (typeof event.data === "string") {
                const data = JSON.parse(event.data);
                setStats(data);
            }
        };
        return () => { ws.current?.close(); };
    }, []);

    const isCongested = stats ? (stats.density > 10 || stats.ambulance) : false;
    const avoidNode = isCongested ? CENTER_NODE : null;

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
                        color: isCongested ? '#ff4444' : '#44ff44',
                        fontWeight: 'bold'
                    }}>
                        {isCongested ? "REROUTING (CONGESTED)" : "OPTIMAL"}
                    </span>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer center={CENTER_NODE} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* The Monitored Junction */}
                    <Circle
                        center={CENTER_NODE}
                        radius={300}
                        pathOptions={{
                            color: isCongested ? 'red' : 'green',
                            fillColor: isCongested ? 'red' : 'green',
                            fillOpacity: 0.2
                        }}
                    >
                        <Popup>Monitored Junction (AI Camera 1)</Popup>
                    </Circle>

                    <Marker position={startPoint}><Popup>Start: {startQuery}</Popup></Marker>
                    <Marker position={endPoint}><Popup>Destination: {endQuery}</Popup></Marker>

                    {/* Routing Logic */}
                    <Routing start={startPoint} end={endPoint} avoidPoint={avoidNode} />

                </MapContainer>
            </div>
        </div>
    );
}
