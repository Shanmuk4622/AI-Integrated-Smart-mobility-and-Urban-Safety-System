import { useEffect, useState, useCallback } from 'react';
import type { AdminViolation, ViolationStats, ViolationStatus } from '../../types';
import {
    getViolations,
    getViolationStats,
    approveViolation,
    rejectViolation,
    subscribeToViolations
} from '../../lib/supabaseAdmin';
import { useAdminAuth } from '../hooks/useAdminAuth';
import ViolationCard from '../components/ViolationCard';
import ReviewModal from '../components/ReviewModal';
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    Filter,
    Bell,
    IndianRupee,
    AlertCircle
} from 'lucide-react';

type FilterStatus = ViolationStatus | 'all';

export default function Violations() {
    const { admin } = useAdminAuth();
    const [violations, setViolations] = useState<AdminViolation[]>([]);
    const [stats, setStats] = useState<ViolationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterStatus>('pending');
    const [selectedViolation, setSelectedViolation] = useState<AdminViolation | null>(null);
    const [newViolationAlert, setNewViolationAlert] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [violationsData, statsData] = await Promise.all([
                getViolations(filter),
                getViolationStats()
            ]);
            setViolations(violationsData);
            setStats(statsData);
        } catch (error) {
            console.error('Error fetching data:', error);
            setErrorMessage('Failed to fetch violations. Please try again.');
        }
    }, [filter]);

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [fetchData]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (errorMessage || successMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
                setSuccessMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage, successMessage]);

    // Real-time subscription for new violations
    useEffect(() => {
        const unsubscribe = subscribeToViolations((newViolation) => {
            console.log('New violation detected:', newViolation);
            setNewViolationAlert(true);
            // Auto-refresh if viewing pending
            if (filter === 'pending' || filter === 'all') {
                fetchData();
            }
        });

        return () => unsubscribe();
    }, [filter, fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        setNewViolationAlert(false);
        setErrorMessage(null);
        await fetchData();
        setRefreshing(false);
    };

    const handleApprove = async (id: number): Promise<void> => {
        if (!admin) {
            setErrorMessage('You must be logged in to approve violations.');
            return;
        }
        const result = await approveViolation(id, admin.id, '', true, 500);
        if (result.success) {
            setSuccessMessage('Violation approved and citation created successfully!');
            await fetchData();
        } else {
            setErrorMessage(result.error || 'Failed to approve violation. Please try again.');
        }
    };

    const handleReject = async (id: number): Promise<void> => {
        if (!admin) {
            setErrorMessage('You must be logged in to reject violations.');
            return;
        }
        const result = await rejectViolation(id, admin.id, '');
        if (result.success) {
            setSuccessMessage('Violation rejected successfully.');
            await fetchData();
        } else {
            setErrorMessage(result.error || 'Failed to reject violation. Please try again.');
        }
    };

    const handleApproveWithDetails = async (id: number, notes: string, fineAmount: number): Promise<void> => {
        if (!admin) {
            setErrorMessage('You must be logged in to approve violations.');
            return;
        }
        const result = await approveViolation(id, admin.id, notes, true, fineAmount);
        if (result.success) {
            setSuccessMessage(`Violation approved! Citation created with fine ₹${fineAmount}.`);
            await fetchData();
        } else {
            setErrorMessage(result.error || 'Failed to approve violation. Please try again.');
        }
    };

    const handleRejectWithDetails = async (id: number, notes: string): Promise<void> => {
        if (!admin) {
            setErrorMessage('You must be logged in to reject violations.');
            return;
        }
        const result = await rejectViolation(id, admin.id, notes);
        if (result.success) {
            setSuccessMessage('Violation rejected successfully.');
            await fetchData();
        } else {
            setErrorMessage(result.error || 'Failed to reject violation. Please try again.');
        }
    };

    const filterButtons: { value: FilterStatus; label: string; icon: React.ReactNode }[] = [
        { value: 'pending', label: 'Pending', icon: <Clock size={16} /> },
        { value: 'approved', label: 'Approved', icon: <CheckCircle size={16} /> },
        { value: 'rejected', label: 'Rejected', icon: <XCircle size={16} /> },
        { value: 'all', label: 'All', icon: <Filter size={16} /> },
    ];

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            {errorMessage && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-lg animate-pulse">
                    <AlertCircle size={20} />
                    <span className="font-medium">{errorMessage}</span>
                    <button
                        onClick={() => setErrorMessage(null)}
                        className="ml-2 text-red-500 hover:text-red-700"
                    >
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            {successMessage && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg shadow-lg">
                    <CheckCircle size={20} />
                    <span className="font-medium">{successMessage}</span>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="ml-2 text-green-500 hover:text-green-700"
                    >
                        <XCircle size={16} />
                    </button>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" />
                        Violation Review
                    </h1>
                    <p className="text-gray-500 mt-1">Review and process detected traffic violations</p>
                </div>
                <div className="flex items-center gap-2">
                    {newViolationAlert && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg animate-pulse">
                            <Bell size={16} />
                            <span className="text-sm font-medium">New violations!</span>
                        </div>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Pending Review</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.total_pending}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <Clock size={20} className="text-yellow-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Approved Today</p>
                                <p className="text-2xl font-bold text-green-600">{stats.approved_today}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <CheckCircle size={20} className="text-green-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Citations</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.total_citations}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <AlertTriangle size={20} className="text-blue-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Revenue Collected</p>
                                <p className="text-2xl font-bold text-emerald-600 flex items-center">
                                    <IndianRupee size={20} />
                                    {stats.revenue_collected.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-3 bg-emerald-100 rounded-lg">
                                <IndianRupee size={20} className="text-emerald-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-fit">
                {filterButtons.map((btn) => (
                    <button
                        key={btn.value}
                        onClick={() => setFilter(btn.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === btn.value
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {btn.icon}
                        {btn.label}
                        {btn.value === 'pending' && stats?.total_pending ? (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${filter === 'pending' ? 'bg-blue-500' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {stats.total_pending}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* Violations Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw size={32} className="text-blue-500 animate-spin" />
                        <p className="text-gray-500">Loading violations...</p>
                    </div>
                </div>
            ) : violations.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                    <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Violations Found</h3>
                    <p className="text-gray-500">
                        {filter === 'pending'
                            ? 'All violations have been reviewed. Great work!'
                            : `No ${filter} violations to display.`
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {violations.map((violation) => (
                        <ViolationCard
                            key={violation.id}
                            violation={violation}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onViewDetails={setSelectedViolation}
                        />
                    ))}
                </div>
            )}

            {/* Review Modal */}
            {selectedViolation && (
                <ReviewModal
                    violation={selectedViolation}
                    isOpen={!!selectedViolation}
                    onClose={() => setSelectedViolation(null)}
                    onApprove={handleApproveWithDetails}
                    onReject={handleRejectWithDetails}
                />
            )}
        </div>
    );
}
