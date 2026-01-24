import { useState } from 'react';
import type { AdminViolation } from '../../types';
import {
    X, MapPin, Clock, Gauge, AlertTriangle,
    CheckCircle, XCircle, FileText, Loader2,
    ExternalLink
} from 'lucide-react';

interface ReviewModalProps {
    violation: AdminViolation;
    isOpen: boolean;
    onClose: () => void;
    onApprove: (id: number, notes: string, fineAmount: number) => Promise<void>;
    onReject: (id: number, notes: string) => Promise<void>;
}

export default function ReviewModal({
    violation,
    isOpen,
    onClose,
    onApprove,
    onReject
}: ReviewModalProps) {
    const [notes, setNotes] = useState('');
    const [fineAmount, setFineAmount] = useState(500);
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);

    if (!isOpen) return null;

    const getViolationColor = (type: string) => {
        switch (type) {
            case 'Wrong Way': return 'text-red-600 bg-red-50 border-red-200';
            case 'Red Light': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Speeding': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'No Helmet': return 'text-purple-600 bg-purple-50 border-purple-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getFinePresets = (type: string): number => {
        switch (type) {
            case 'Wrong Way': return 1000;
            case 'Red Light': return 500;
            case 'Speeding': return 750;
            case 'No Helmet': return 300;
            default: return 500;
        }
    };

    const handleApprove = async () => {
        setLoading(true);
        setAction('approve');
        try {
            await onApprove(violation.id, notes, fineAmount);
            onClose();
        } finally {
            setLoading(false);
            setAction(null);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        setAction('reject');
        try {
            await onReject(violation.id, notes);
            onClose();
        } finally {
            setLoading(false);
            setAction(null);
        }
    };

    const formatDateTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const confidencePercent = violation.confidence_score
        ? Math.round(violation.confidence_score * 100)
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertTriangle size={24} className="text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Violation Review</h2>
                            <p className="text-sm text-gray-500">ID: #{violation.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid md:grid-cols-2 gap-6 p-6">
                        {/* Left: Image */}
                        <div className="space-y-4">
                            <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video">
                                {violation.image_url ? (
                                    <>
                                        <img
                                            src={violation.image_url}
                                            alt={`Violation: ${violation.violation_type}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <a
                                            href={violation.image_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-black/90 transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            Full Size
                                        </a>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                            <AlertTriangle size={48} className="mx-auto mb-2 opacity-50" />
                                            <span>No Evidence Image</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confidence Indicator */}
                            {confidencePercent !== null && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">AI Confidence</span>
                                        <span className={`text-sm font-bold ${confidencePercent >= 90 ? 'text-green-600' :
                                            confidencePercent >= 70 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>
                                            {confidencePercent}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all ${confidencePercent >= 90 ? 'bg-green-500' :
                                                confidencePercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                            style={{ width: `${confidencePercent}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Details */}
                        <div className="space-y-4">
                            {/* Violation Type */}
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getViolationColor(violation.violation_type)}`}>
                                <AlertTriangle size={18} />
                                <span className="font-bold">{violation.violation_type}</span>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <MapPin size={12} />
                                        LOCATION
                                    </div>
                                    <div className="font-medium text-gray-900">
                                        {violation.junctions?.name || `Junction ${violation.junction_id}`}
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                        <Clock size={12} />
                                        TIMESTAMP
                                    </div>
                                    <div className="font-medium text-gray-900 text-sm">
                                        {formatDateTime(violation.timestamp)}
                                    </div>
                                </div>

                                {violation.vehicle_speed && (
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                                            <Gauge size={12} />
                                            SPEED
                                        </div>
                                        <div className="font-bold text-blue-600 text-lg">
                                            {Math.round(violation.vehicle_speed)} km/h
                                        </div>
                                    </div>
                                )}

                                {violation.license_plate && (
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="text-gray-500 text-xs mb-1">
                                            LICENSE PLATE
                                        </div>
                                        <div className="font-mono font-bold text-gray-900">
                                            {violation.license_plate}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Fine Amount */}
                            {violation.status === 'pending' && (
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                    <label className="block text-sm font-medium text-blue-800 mb-2">
                                        Fine Amount (₹)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={fineAmount}
                                            onChange={(e) => setFineAmount(Number(e.target.value))}
                                            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-bold"
                                            min={0}
                                        />
                                        <button
                                            onClick={() => setFineAmount(getFinePresets(violation.violation_type))}
                                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                                        >
                                            Use Preset
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Admin Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <FileText size={14} className="inline mr-1" />
                                    Review Notes
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes about this violation..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    rows={3}
                                    disabled={violation.status !== 'pending'}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                {violation.status === 'pending' && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading && action === 'reject' ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <XCircle size={18} />
                            )}
                            Reject
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading && action === 'approve' ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <CheckCircle size={18} />
                            )}
                            Approve & Issue Challan
                        </button>
                    </div>
                )}

                {/* If already reviewed */}
                {violation.status !== 'pending' && (
                    <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
                        <div className="text-sm text-gray-500">
                            Reviewed on {violation.reviewed_at ? formatDateTime(violation.reviewed_at) : 'N/A'}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
