import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Map as MapIcon,
    AlertTriangle,
    FileText,
    Settings,
    LogOut,
    Menu,
    X,
    Bell,
    Loader2,
    BarChart3
} from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminLayout() {
    const { admin, loading, signOut } = useAdminAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="text-blue-600 animate-spin" />
                    <p className="text-gray-500 font-medium">Verifying Access...</p>
                </div>
            </div>
        );
    }

    if (!admin) {
        return null; // Hook redirects to login
    }

    const navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Junctions', path: '/admin/junctions', icon: MapIcon },
        { name: 'Violations', path: '/admin/violations', icon: AlertTriangle },
        { name: 'Challans', path: '/admin/challans', icon: FileText },
        { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
        { name: 'Settings', path: '/admin/settings', icon: Settings },
    ];

    const handleLogout = () => {
        signOut();
    };

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:relative lg:translate-x-0 shadow-xl`}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="font-bold text-lg">A</span>
                        </div>
                        <span className="text-xl font-semibold tracking-tight">AdminPanel</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X size={24} />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon size={20} />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex items-center gap-4 ml-auto">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold border border-blue-200">
                            {admin.full_name ? admin.full_name.substring(0, 2).toUpperCase() : 'AD'}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
