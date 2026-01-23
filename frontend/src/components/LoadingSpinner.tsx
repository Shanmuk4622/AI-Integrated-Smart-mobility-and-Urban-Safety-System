/**
 * Reusable loading spinner component.
 */

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    message?: string;
    fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'medium',
    message,
    fullScreen = false
}) => {
    const sizeMap = {
        small: '20px',
        medium: '40px',
        large: '60px'
    };

    const spinnerSize = sizeMap[size];

    const spinnerStyle: React.CSSProperties = {
        border: `4px solid rgba(79, 172, 254, 0.2)`,
        borderTop: `4px solid #4facfe`,
        borderRadius: '50%',
        width: spinnerSize,
        height: spinnerSize,
        animation: 'spin 1s linear infinite'
    };

    const containerStyle: React.CSSProperties = fullScreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999
    } : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    };

    return (
        <>
            <style>
                {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
            </style>
            <div style={containerStyle}>
                <div style={spinnerStyle}></div>
                {message && (
                    <p style={{
                        marginTop: '15px',
                        color: fullScreen ? 'white' : '#333',
                        fontSize: '14px',
                        fontWeight: 500
                    }}>
                        {message}
                    </p>
                )}
            </div>
        </>
    );
};

export default LoadingSpinner;
