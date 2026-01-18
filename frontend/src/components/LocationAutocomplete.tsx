
import { useState, useEffect, useRef } from 'react';

interface Suggestion {
    place_id: number;
    lat: string;
    lon: string;
    display_name: string;
}

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (lat: number, lon: number, displayName: string) => void;
    placeholder?: string;
}

export default function LocationAutocomplete({ value, onChange, onSelect, placeholder }: LocationAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Debounce logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (value.length > 2 && isOpen) {
                fetchSuggestions(value);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [value, isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const fetchSuggestions = async (query: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();
            setSuggestions(data);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (s: Suggestion) => {
        onChange(s.display_name); // Update input text
        onSelect(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
        setIsOpen(false);
        setSuggestions([]);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '300px' }}>
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => value.length > 2 && setIsOpen(true)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    background: '#333',
                    color: 'white',
                    outline: 'none'
                }}
            />

            {isOpen && (suggestions.length > 0 || isLoading) && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '0 0 4px 4px',
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    {isLoading && (
                        <li style={{ padding: '10px', color: '#888' }}>Loading...</li>
                    )}

                    {!isLoading && suggestions.map((s) => (
                        <li
                            key={s.place_id}
                            onClick={() => handleSelect(s)}
                            style={{
                                padding: '10px',
                                borderBottom: '1px solid #333',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                color: '#ddd',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#444')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            {s.display_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
