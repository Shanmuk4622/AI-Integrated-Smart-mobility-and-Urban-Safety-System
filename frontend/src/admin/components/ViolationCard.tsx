import { useState } from 'react';
import type { AdminViolation } from '../../types';
import { AlertTriangle, Clock, MapPin, Gauge, CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';

interface ViolationCardProps {
    violation: AdminViolation;
    onApprove: (id: number) => Promise<void>;
    onReject: (id: number) => Promise<void>;
    onViewDetails: (violation: AdminViolation) => void;
}

export default function ViolationCard({
    violation,
    onApprove,
    onReject,
    onViewDetails
}: ViolationCardProps) {
    const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

    const getViolationColor = (type: string) => {
        switch (type) {
            case 'Wrong Way':
                return 'bg-red-500';
            case 'Red Light':
                return 'bg-orange-500';
            case 'Speeding':
                return 'bg-yellow-500';
            case 'No Helmet':
                return 'bg-purple-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'approved':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'rejected':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'appealed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleApprove = async () => {
        setLoading('approve');
        try {
            await onApprove(violation.id);
        } finally {
            setLoading(null);
        }
    };

    const handleReject = async () => {
        setLoading('reject');
        try {
            await onReject(violation.id);
        } finally {
            setLoading(null);
        }
    };

    const confidencePercent = violation.confidence_score
        ? Math.round(violation.confidence_score * 100)
        : null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 group">
            {/* Image Section */}
            <div className="relative h-44 bg-gray-100">
                {violation.image_url ? (
                    <img
                        src={violation.image_url}
                        alt={`Violation: ${violation.violation_type}`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                            <span className="text-sm">No Image</span>
                        </div>
                    </div>
                )}

                {/* Confidence Badge */}
                {confidencePercent !== null && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
                        {confidencePercent}% Confidence
                    </div>
                )}

                {/* Violation Type Badge */}
                <div className={`absolute top-2 left-2 ${getViolationColor(violation.violation_type)} text-white text-xs font-bold px-2 py-1 rounded-lg`}>
                    {violation.violation_type}
                </div>

                {/* Hover Overlay */}
                <div
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => onViewDetails(violation)}
                >
                    <button className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors">
                        <Eye size={16} />
                        View Details
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400" />
                            {violation.junctions?.name || `Junction ${violation.junction_id}`}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock size={12} />
                            {formatTime(violation.timestamp)}
                        </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusBadge(violation.status)}`}>
                        {violation.status.toUpperCase()}
                    </span>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    {violation.vehicle_speed && (
                        <div className="flex items-center gap-1">
                            <Gauge size={14} className="text-blue-500" />
                            <span className="font-medium">{Math.round(violation.vehicle_speed)} km/h</span>
                        </div>
                    )}
                    {violation.license_plate && (
                        <div className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">
                            {violation.license_plate}
                        </div>
                    )}
                </div>

                {/* Action Buttons - Only show for pending */}
                {violation.status === 'pending' && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleApprove}
                            disabled={loading !== null}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading === 'approve' ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <CheckCircle size={16} />
                            )}
                            {loading === 'approve' ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={loading !== null}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading === 'reject' ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <XCircle size={16} />
                            )}
                            {loading === 'reject' ? 'Rejecting...' : 'Reject'}
                        </button>
                    </div>
                )}

                {/* Reviewed info */}
                {violation.status !== 'pending' && violation.reviewed_at && (
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                        Reviewed {formatTime(violation.reviewed_at)}
                    </div>
                )}
            </div>
        </div>
    );
}
