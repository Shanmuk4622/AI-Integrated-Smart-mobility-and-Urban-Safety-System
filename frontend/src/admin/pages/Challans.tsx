import { useEffect, useState } from 'react';
import type { Citation } from '../../types';
import { getCitations, markCitationPaid } from '../../lib/supabaseAdmin';
import {
    FileText,
    RefreshCw,
    Filter,
    CheckCircle,
    Clock,
    IndianRupee,
    Search,
    Printer,
    CreditCard,
    AlertCircle
} from 'lucide-react';

type PaymentFilter = 'all' | 'paid' | 'unpaid';

export default function Challans() {
    const [citations, setCitations] = useState<Citation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<PaymentFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchCitations = async () => {
        const paidStatus = filter === 'all' ? 'all' : filter === 'paid';
        const data = await getCitations(paidStatus);
        setCitations(data);
    };

    useEffect(() => {
        setLoading(true);
        fetchCitations().finally(() => setLoading(false));
    }, [filter]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchCitations();
        setRefreshing(false);
    };

    const handleMarkPaid = async (citationId: number) => {
        setProcessingId(citationId);
        const result = await markCitationPaid(citationId, 'manual', `MANUAL-${Date.now()}`);
        if (result.success) {
            await fetchCitations();
        }
        setProcessingId(null);
    };

    const filteredCitations = citations.filter((c) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            c.citation_number.toLowerCase().includes(search) ||
            c.violation?.license_plate?.toLowerCase().includes(search) ||
            c.violation?.violation_type?.toLowerCase().includes(search)
        );
    });

    const stats = {
        total: citations.length,
        paid: citations.filter(c => c.paid).length,
        unpaid: citations.filter(c => !c.paid).length,
        totalRevenue: citations.filter(c => c.paid).reduce((sum, c) => sum + c.fine_amount, 0),
        pendingRevenue: citations.filter(c => !c.paid).reduce((sum, c) => sum + c.fine_amount, 0)
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const isOverdue = (dueDate: string) => {
        return new Date(dueDate) < new Date();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="text-blue-500" />
                        Challan Management
                    </h1>
                    <p className="text-gray-500 mt-1">Track and manage issued traffic citations</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Total Citations</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Paid</p>
                    <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Unpaid</p>
                    <p className="text-2xl font-bold text-red-600">{stats.unpaid}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Collected</p>
                    <p className="text-2xl font-bold text-emerald-600 flex items-center">
                        <IndianRupee size={18} />
                        {stats.totalRevenue.toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-amber-600 flex items-center">
                        <IndianRupee size={18} />
                        {stats.pendingRevenue.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm">
                    {(['all', 'unpaid', 'paid'] as PaymentFilter[]).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {status === 'all' && <Filter size={16} />}
                            {status === 'paid' && <CheckCircle size={16} />}
                            {status === 'unpaid' && <Clock size={16} />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by citation #, license plate..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Citations Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw size={32} className="text-blue-500 animate-spin" />
                </div>
            ) : filteredCitations.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Citations Found</h3>
                    <p className="text-gray-500">
                        {searchTerm
                            ? 'No citations match your search criteria.'
                            : 'No citations have been issued yet.'
                        }
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Citation #</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Violation</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredCitations.map((citation) => (
                                    <tr key={citation.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                {citation.citation_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {citation.violation?.violation_type || 'N/A'}
                                                </span>
                                                {citation.violation?.license_plate && (
                                                    <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                                                        {citation.violation.license_plate}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-900 flex items-center">
                                                <IndianRupee size={14} />
                                                {citation.fine_amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-sm ${!citation.paid && isOverdue(citation.due_date)
                                                ? 'text-red-600 font-medium'
                                                : 'text-gray-600'
                                                }`}>
                                                {formatDate(citation.due_date)}
                                                {!citation.paid && isOverdue(citation.due_date) && (
                                                    <span className="ml-2 inline-flex items-center text-xs">
                                                        <AlertCircle size={12} className="mr-1" />
                                                        Overdue
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {citation.paid ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                    <CheckCircle size={12} />
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                                    <Clock size={12} />
                                                    Unpaid
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {!citation.paid && (
                                                    <button
                                                        onClick={() => handleMarkPaid(citation.id)}
                                                        disabled={processingId === citation.id}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === citation.id ? (
                                                            <RefreshCw size={14} className="animate-spin" />
                                                        ) : (
                                                            <CreditCard size={14} />
                                                        )}
                                                        Mark Paid
                                                    </button>
                                                )}
                                                <button
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                                >
                                                    <Printer size={14} />
                                                    Print
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
