import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
    Settings as SettingsIcon,
    Users,
    Sliders,
    Bell,
    Save,
    RefreshCw,
    Plus,
    Shield,
    IndianRupee
} from 'lucide-react';

interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    department?: string;
    is_active: boolean;
    created_at: string;
}

interface SystemConfig {
    congestion_thresholds: { low: number; medium: number; high: number };
    fine_amounts: { [key: string]: number };
    auto_approve_threshold: number;
}

export default function Settings() {
    const { admin } = useAdminAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'thresholds' | 'fines' | 'notifications'>('users');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [config, setConfig] = useState<SystemConfig>({
        congestion_thresholds: { low: 10, medium: 20, high: 30 },
        fine_amounts: {
            'Wrong Way': 1000,
            'Red Light': 500,
            'Speeding': 750,
            'No Helmet': 300
        },
        auto_approve_threshold: 0.95
    });

    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('operator');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch admin users
            const { data: usersData } = await supabase
                .from('admin_users')
                .select('*')
                .order('created_at', { ascending: false });

            setUsers(usersData || []);

            // Fetch system config
            const { data: configData } = await supabase
                .from('system_config')
                .select('key, value');

            if (configData) {
                const newConfig = { ...config };
                configData.forEach(c => {
                    if (c.key === 'congestion_thresholds') {
                        newConfig.congestion_thresholds = c.value;
                    } else if (c.key === 'fine_amounts') {
                        newConfig.fine_amounts = c.value;
                    } else if (c.key === 'auto_approve_threshold') {
                        newConfig.auto_approve_threshold = c.value;
                    }
                });
                setConfig(newConfig);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async (key: string, value: any) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('system_config')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString(),
                    updated_by: admin?.id
                });

            if (error) throw error;
            // Update local state
            if (key === 'congestion_thresholds') {
                setConfig(prev => ({ ...prev, congestion_thresholds: value }));
            } else if (key === 'fine_amounts') {
                setConfig(prev => ({ ...prev, fine_amounts: value }));
            }
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUserEmail || !newUserName) return;

        try {
            const { error } = await supabase
                .from('admin_users')
                .insert({
                    email: newUserEmail,
                    full_name: newUserName,
                    role: newUserRole,
                    is_active: true,
                    created_by: admin?.id
                });

            if (error) throw error;

            setNewUserEmail('');
            setNewUserName('');
            setNewUserRole('operator');
            await fetchData();
        } catch (error) {
            console.error('Error adding user:', error);
        }
    };

    const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('admin_users')
                .update({ is_active: !currentStatus, updated_by: admin?.id })
                .eq('id', userId);

            if (error) throw error;
            await fetchData();
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const tabs = [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'thresholds', label: 'Traffic Thresholds', icon: Sliders },
        { id: 'fines', label: 'Fine Amounts', icon: IndianRupee },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ] as const;

    const roleColors: { [key: string]: string } = {
        super_admin: 'bg-purple-100 text-purple-700',
        traffic_manager: 'bg-blue-100 text-blue-700',
        operator: 'bg-green-100 text-green-700',
        auditor: 'bg-yellow-100 text-yellow-700',
        analyst: 'bg-gray-100 text-gray-700'
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={32} className="text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <SettingsIcon className="text-gray-500" />
                    System Settings
                </h1>
                <p className="text-gray-500 mt-1">Manage users, thresholds, and system configuration</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="p-6 space-y-6">
                        {/* Add User Form */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Plus size={18} />
                                Add New Admin User
                            </h3>
                            <div className="grid md:grid-cols-4 gap-4">
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="operator">Operator</option>
                                    <option value="traffic_manager">Traffic Manager</option>
                                    <option value="analyst">Analyst</option>
                                    <option value="auditor">Auditor</option>
                                </select>
                                <button
                                    onClick={handleAddUser}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus size={18} />
                                    Add User
                                </button>
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{user.full_name}</p>
                                                    <p className="text-sm text-gray-500">{user.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[user.role] || 'bg-gray-100 text-gray-700'}`}>
                                                    <Shield size={12} />
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${user.is_active
                                                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                        }`}
                                                >
                                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Thresholds Tab */}
                {activeTab === 'thresholds' && (
                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-4">Congestion Level Thresholds</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Configure vehicle count thresholds for traffic congestion classification.
                            </p>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <label className="block text-sm font-medium text-green-700 mb-2">Low Traffic (max)</label>
                                    <input
                                        type="number"
                                        value={config.congestion_thresholds.low}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            congestion_thresholds: { ...prev.congestion_thresholds, low: Number(e.target.value) }
                                        }))}
                                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                    />
                                    <p className="text-xs text-green-600 mt-1">0 - {config.congestion_thresholds.low} vehicles</p>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                    <label className="block text-sm font-medium text-yellow-700 mb-2">Medium Traffic (max)</label>
                                    <input
                                        type="number"
                                        value={config.congestion_thresholds.medium}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            congestion_thresholds: { ...prev.congestion_thresholds, medium: Number(e.target.value) }
                                        }))}
                                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                    />
                                    <p className="text-xs text-yellow-600 mt-1">{config.congestion_thresholds.low + 1} - {config.congestion_thresholds.medium} vehicles</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                    <label className="block text-sm font-medium text-red-700 mb-2">High Traffic (max)</label>
                                    <input
                                        type="number"
                                        value={config.congestion_thresholds.high}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            congestion_thresholds: { ...prev.congestion_thresholds, high: Number(e.target.value) }
                                        }))}
                                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                    />
                                    <p className="text-xs text-red-600 mt-1">{config.congestion_thresholds.medium + 1}+ vehicles</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSaveConfig('congestion_thresholds', config.congestion_thresholds)}
                                disabled={saving}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Thresholds
                            </button>
                        </div>
                    </div>
                )}

                {/* Fines Tab */}
                {activeTab === 'fines' && (
                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-4">Violation Fine Amounts</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Set default fine amounts for each violation type (in ₹).
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(config.fine_amounts).map(([type, amount]) => (
                                    <div key={type} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">{type}</label>
                                        <div className="relative">
                                            <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setConfig(prev => ({
                                                    ...prev,
                                                    fine_amounts: { ...prev.fine_amounts, [type]: Number(e.target.value) }
                                                }))}
                                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => handleSaveConfig('fine_amounts', config.fine_amounts)}
                                disabled={saving}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Fine Amounts
                            </button>
                        </div>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="p-6">
                        <div className="bg-gray-50 rounded-lg p-8 text-center">
                            <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Notification Settings</h3>
                            <p className="text-gray-500">
                                Email and SMS notification settings will be available soon.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
