/**
 * React Error Boundary component.
 * Catches JavaScript errors anywhere in the component tree and displays fallback UI.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error details
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // You can also log to an error reporting service here
        // Example: logErrorToService(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div style={{
                    padding: '40px',
                    maxWidth: '600px',
                    margin: '40px auto',
                    backgroundColor: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '8px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <h2 style={{ color: '#856404', marginTop: 0 }}>
                        ⚠️ Something went wrong
                    </h2>

                    <p style={{ color: '#856404' }}>
                        The application encountered an unexpected error. Please try refreshing the page.
                    </p>

                    {this.state.error && (
                        <details style={{ marginTop: '20px' }}>
                            <summary style={{
                                cursor: 'pointer',
                                color: '#856404',
                                fontWeight: 'bold',
                                marginBottom: '10px'
                            }}>
                                Error Details
                            </summary>
                            <pre style={{
                                backgroundColor: '#f8f9fa',
                                padding: '15px',
                                borderRadius: '4px',
                                overflow: 'auto',
                                fontSize: '12px',
                                color: '#212529'
                            }}>
                                {this.state.error.toString()}
                                {this.state.errorInfo && (
                                    <>
                                        {'\n\n'}
                                        {this.state.errorInfo.componentStack}
                                    </>
                                )}
                            </pre>
                        </details>
                    )}

                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#ffc107',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                marginRight: '10px'
                            }}
                        >
                            Try Again
                        </button>

                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
