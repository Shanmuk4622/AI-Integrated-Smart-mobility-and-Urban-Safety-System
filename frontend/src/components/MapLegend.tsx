/**
 * Map Legend Component
 * Displays junction status indicators
 */

import React from 'react';

export const MapLegend: React.FC = () => {
    return (
        <div className="map-legend fade-in">
            <div className="legend-title">Junction Status</div>
            <div className="legend-item">
                <div className="legend-color active"></div>
                <span>Active</span>
            </div>
            <div className="legend-item">
                <div className="legend-color maintenance"></div>
                <span>Maintenance</span>
            </div>
            <div className="legend-item">
                <div className="legend-color offline"></div>
                <span>Offline</span>
            </div>
        </div>
    );
};

export default MapLegend;
