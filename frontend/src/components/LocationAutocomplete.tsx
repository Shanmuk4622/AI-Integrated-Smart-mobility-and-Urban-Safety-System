import { useEffect, useRef, useState } from 'react';

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (lat: number, lon: number, displayName: string) => void;
    placeholder?: string;
}

// We rely on the Google Maps script being loaded by RoadMap's APIProvider or globally.
// However, since this might be used outside the map context, we should ideally load it.
// For now, we'll assume the script is loaded, or we check for window.google.

export default function LocationAutocomplete({ value, onChange, onSelect, placeholder }: LocationAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!inputRef.current || !window.google || !window.google.maps || !window.google.maps.places) {
            // If google maps isn't loaded yet, we might need to wait or rely on APIProvider being up.
            // A simple retry mechanism or check.
            return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            fields: ['place_id', 'geometry', 'name', 'formatted_address'],
            types: ['geocode', 'establishment']
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();

            if (!place.geometry || !place.geometry.location) {
                setError("No location data available for this place.");
                return;
            }

            const lat = place.geometry.location.lat();
            const lon = place.geometry.location.lng();
            const displayName = place.formatted_address || place.name || "";

            onChange(displayName);
            onSelect(lat, lon, displayName);
            setError(null);
        });

        // Styling for the autocomplete dropdown is handled by Google, 
        // but we can override class .pac-container in CSS if needed.

    }, [onChange, onSelect]);

    return (
        <div style={{ position: 'relative', width: '300px' }}>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Search location..."}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'white',
                    outline: 'none',
                    backdropFilter: 'blur(10px)',
                    fontSize: '0.95rem'
                }}
            />
            {error && (
                <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '4px' }}>
                    {error}
                </div>
            )}
        </div>
    );
}
