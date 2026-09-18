import React, { useState, useEffect, useCallback } from 'react';
import { 
    Truck, MapPin, Clock, CheckCircle, AlertCircle, Package, QrCode,
    Navigation, RefreshCw, User, Calendar, TrendingUp, Award, Bell,
    Settings, LogOut, Menu, X, Wifi, WifiOff, Download, Upload, Database, 
    Leaf, ChevronRight, ArrowRight, Info, CheckCircle2, Camera
} from 'lucide-react';
import PickupQueue from '../../components/PickupQueue';
import PickupDetails from '../../components/PickupDetails';
import offlineService from '../../services/offlineService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CollectorDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedPickup, setSelectedPickup] = useState(null);
    const [pickups, setPickups] = useState([]);
    const [assignedWork, setAssignedWork] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [cacheStatus, setCacheStatus] = useState(null);
    const [syncInProgress, setSyncInProgress] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [stats, setStats] = useState({
        todayPickups: 12,
        completedToday: 8,
        totalEarnings: 2450,
        rating: 4.8
    });

    // Retrieve real logged-in user from localStorage
    const userInfoString = localStorage.getItem('userInfo');
    const currentUser = userInfoString ? JSON.parse(userInfoString) : {
        _id: 'collector_123',
        name: 'Collector User',
        email: 'collector@ecocycle.bd',
        role: 'collector'
    };

    const collectorId = currentUser._id || currentUser.id;

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncOfflineData();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const unsubscribe = offlineService.addListener((event, online) => {
            setIsOnline(online);
            if (online) syncOfflineData();
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            unsubscribe();
        };
    }, []);

    useEffect(() => { loadCacheStatus(); }, []);
    useEffect(() => { 
        loadPickupData(); 
        loadAssignedWork();
    }, [isOnline, collectorId]);

    const loadCacheStatus = async () => {
        try {
            const status = await offlineService.getCacheStatus();
            setCacheStatus(status);
        } catch (error) { console.error('Failed to load cache status:', error); }
    };

    const loadPickupData = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            if (isOnline) {
                const response = await fetch(`${API_BASE_URL}/api/pickup/available`, { headers });
                if (response.ok) {
                    const data = await response.json();
                    const items = Array.isArray(data) ? data : (data.pickups || data.data || []);
                    setPickups(items);
                    await offlineService.cachePickupData(collectorId, items);
                } else { throw new Error('Failed to fetch pickups'); }
            } else {
                const cachedData = await offlineService.getCachedPickupData(collectorId);
                if (cachedData.success) setPickups(cachedData.pickups);
                else setError('No cached data available offline');
            }
        } catch (error) {
            try {
                const cachedData = await offlineService.getCachedPickupData(collectorId);
                if (cachedData.success && cachedData.pickups.length > 0) {
                    setPickups(cachedData.pickups);
                    setError('Using cached data - some information may be outdated');
                } else { setError(isOnline ? 'Failed to load pickups' : 'No offline data available'); }
            } catch (cacheError) { setError('Failed to load pickup data'); }
        } finally { setLoading(false); }
    };

    // Fetch jobs specifically assigned to this collector
    const loadAssignedWork = async () => {
        if (!collectorId) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/pickup/collector/${collectorId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                const assignedList = result.data || result.pickups || (Array.isArray(result) ? result : []);
                setAssignedWork(assignedList);
            }
        } catch (err) {
            console.error("Failed to load assigned work:", err);
        }
    };

    const syncOfflineData = async () => {
        if (!isOnline) return;
        try {
            setSyncInProgress(true);
            await offlineService.syncPendingUpdates();
            await loadPickupData(); 
            await loadAssignedWork();
            await loadCacheStatus();
        } catch (error) { console.error('Sync failed:', error);
        } finally { setSyncInProgress(false); }
    };

    const handlePickupStatusUpdate = async (pickupId, newStatus, notes = '') => {
        try {
            const updateData = { status: newStatus, notes: notes, timestamp: new Date().toISOString() };
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            if (isOnline) {
                const response = await fetch(`${API_BASE_URL}/api/pickup/${pickupId}/status`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(updateData)
                });
                if (response.ok) {
                    setPickups(prev => prev.map(pickup => pickup._id === pickupId ? { ...pickup, status: newStatus, notes: notes } : pickup));
                    setAssignedWork(prev => prev.map(pickup => pickup._id === pickupId ? { ...pickup, status: newStatus, notes: notes } : pickup));
                } else { throw new Error('Failed to update pickup status'); }
            } else {
                await offlineService.storeOfflineUpdate(pickupId, updateData, token);
                setPickups(prev => prev.map(pickup => pickup._id === pickupId ? { ...pickup, status: newStatus, notes: notes } : pickup));
                setAssignedWork(prev => prev.map(pickup => pickup._id === pickupId ? { ...pickup, status: newStatus, notes: notes } : pickup));
                await loadCacheStatus(); 
            }
        } catch (error) { console.error('Failed to update pickup status:', error); throw error; }
    };

    // Complete assigned work handler (Mark as Done button)
    const handleCompleteAssignedWork = async (pickupId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/pickup/${pickupId}/complete`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    actualWeight: 1, // Default or captured weight
                    notes: 'Completed by collector',
                    collectorId: collectorId
                })
            });

            if (response.ok) {
                // Refresh list
                loadAssignedWork();
                loadPickupData();
            } else {
                // Fallback to general status update if complete route differs
                await handlePickupStatusUpdate(pickupId, 'completed', 'Completed task');
                loadAssignedWork();
            }
        } catch (err) {
            console.error("Error completing assigned work:", err);
            alert("Failed to mark task as completed.");
        }
    };

    const handleRefresh = useCallback(async () => {
        if (isOnline) { 
            await loadPickupData(); 
            await loadAssignedWork();
        } else {
            const cachedData = await offlineService.getCachedPickupData(collectorId);
            if (cachedData.success) setPickups(cachedData.pickups);
        }
    }, [isOnline, collectorId]);

    const clearOfflineCache = async () => {
        try {
            await offlineService.clearCache();
            await loadCacheStatus();
            if (!isOnline) setPickups([]);
        } catch (error) { console.error('Failed to clear cache:', error); }
    };

    const handleLogout = () => {
        setIsExiting(true);
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            localStorage.removeItem('token');
            window.location.href = '/login';
        }, 400);
    };

    const StatCard = ({ icon: Icon, title, value, subtitle, theme, delay }) => {
        const themes = {
            blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
            green: { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
            purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
            yellow: { text: 'text-yellow-600', bg: 'bg-yellow-50' }
        };
        const currentTheme = themes[theme] || themes.blue;

        return (
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-6 hover:shadow-[0_15px_40px_rgba(5,31,32,0.08)] hover:-translate-y-1 transition-all duration-300 group animate-slideUp opacity-0" style={{ animationDelay: delay, animationFillMode: 'forwards' }}>
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-[#8EB69B] uppercase tracking-wider truncate mb-1">{title}</p>
                        <p className="text-2xl sm:text-3xl font-bold text-[#051F20]">{value}</p>
                        {subtitle && <p className="text-xs font-medium text-[#235347] mt-2 truncate">{subtitle}</p>}
                    </div>
                    <div className={`p-4 rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${currentTheme.bg}`}>
                        <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${currentTheme.text}`} />
                    </div>
                </div>
            </div>
        );
    };

    const Sidebar = () => (
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#051F20] shadow-2xl transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
            <div className="flex items-center justify-between h-24 px-8 border-b border-white/10">
                <div className="flex items-center gap-3 cursor-pointer group">
                    <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                    <span className="text-2xl font-bold tracking-wide text-white">EcoCycle</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-white/50 hover:text-[#22c55e] active:scale-90 transition-all">
                    <X className="h-6 w-6" />
                </button>
            </div>
            
            <div className="px-6 py-6 border-b border-white/10">
                <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isOnline ? 'bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e]' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'}`}>
                    {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                    <span className="text-sm font-bold tracking-wide">
                        {isOnline ? 'System Online' : 'Offline Mode Active'}
                    </span>
                    {syncInProgress && <RefreshCw className="h-4 w-4 animate-spin ml-auto" />}
                </div>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
                {[
                    { id: 'overview', label: 'Dashboard', icon: TrendingUp },
                    { id: 'assigned', label: `Assigned Work (${assignedWork.filter(w => w.status !== 'completed').length})`, icon: Truck },
                    { id: 'pickups', label: 'Active Pickups', icon: Package },
                    { id: 'scanner', label: 'QR Scanner', icon: QrCode },
                    { id: 'offline', label: 'Offline Center', icon: Database },
                    { id: 'history', label: 'Work History', icon: Clock },
                    { id: 'profile', label: 'My Profile', icon: User },
                    { id: 'settings', label: 'Settings', icon: Settings }
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                        className={`w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-300 active:scale-95 cursor-pointer ${
                            activeTab === item.id
                                ? 'bg-[#22c55e] text-[#051F20] shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                : 'text-[#8EB69B] hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.label}
                        {activeTab === item.id && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                    </button>
                ))}
            </nav>
            
            <div className="p-6 border-t border-white/10">
                <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-3.5 text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-300 active:scale-95 cursor-pointer">
                    <LogOut className="mr-3 h-5 w-5" />
                    Secure Sign Out
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard icon={Package} title="Today's Pickups" value={stats.todayPickups} subtitle="3 pending routing" theme="blue" delay="0.1s" />
                            <StatCard icon={Truck} title="Assigned Tasks" value={assignedWork.filter(w => w.status !== 'completed').length} subtitle="Pending completion" theme="purple" delay="0.2s" />
                            <StatCard icon={CheckCircle} title="Completed" value={stats.completedToday} subtitle="67% daily goal" theme="green" delay="0.3s" />
                            <StatCard icon={TrendingUp} title="Performance" value={stats.rating} subtitle="Top 5% of collectors" theme="yellow" delay="0.4s" />
                        </div>
                        
                        {/* Quick Assigned Work Preview Card */}
                        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-8">
                            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                                <h2 className="text-xl font-bold text-[#051F20]">Assigned Work Pending</h2>
                                <button onClick={() => setActiveTab('assigned')} className="text-sm font-bold text-[#22c55e] hover:underline flex items-center gap-1 cursor-pointer">
                                    Manage All <ArrowRight size={16} />
                                </button>
                            </div>
                            {assignedWork.filter(w => w.status !== 'completed').length === 0 ? (
                                <p className="text-sm text-gray-500 py-4 text-center">No active tasks assigned to you right now.</p>
                            ) : (
                                <div className="space-y-4">
                                    {assignedWork.filter(w => w.status !== 'completed').slice(0, 3).map(work => (
                                        <div key={work._id} className="flex items-center justify-between p-4 bg-[#F4F9F5] rounded-xl border border-[#22c55e]/20">
                                            <div>
                                                <p className="font-bold text-[#051F20]">Address: {work.address?.street || work.pickupDetails?.address || 'Standard Location'}</p>
                                                <p className="text-xs text-[#235347] mt-1">Weight: {work.estimatedWeight || 1} kg | Status: <span className="uppercase font-bold text-blue-600">{work.status}</span></p>
                                            </div>
                                            <button 
                                                onClick={() => handleCompleteAssignedWork(work._id)}
                                                className="px-4 py-2 bg-[#22c55e] text-[#051F20] font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#051F20] hover:text-white transition-all cursor-pointer shadow-sm"
                                            >
                                                Mark as Done
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            
            // --- NEW SEPARATE ASSIGNED WORK SECTION ---
            case 'assigned':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div>
                                <h2 className="text-2xl font-bold text-[#051F20]">Assigned Work Queue</h2>
                                <p className="text-sm text-[#8EB69B]">Review and mark tasks assigned to you by admin</p>
                            </div>
                            <button onClick={loadAssignedWork} className="p-3 bg-[#F4F9F5] border border-gray-200 rounded-xl text-[#051F20] hover:bg-[#051F20] hover:text-white transition-all cursor-pointer">
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
                            {assignedWork.length === 0 ? (
                                <div className="py-16 text-center text-gray-400">
                                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                    <p className="font-bold">No assigned work found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {assignedWork.map((work) => {
                                        const isDone = work.status === 'completed';
                                        return (
                                            <div key={work._id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-[#F4F9F5] rounded-2xl border border-gray-200/60 gap-4 hover:border-[#22c55e]/40 transition-all">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold uppercase tracking-wider">
                                                            {work.status || 'Assigned'}
                                                        </span>
                                                        <span className="text-xs font-bold text-[#8EB69B]">ID: {work._id.slice(-6).toUpperCase()}</span>
                                                    </div>
                                                    <p className="text-base font-bold text-[#051F20] flex items-center gap-1.5 mt-2">
                                                        <MapPin size={16} className="text-[#22c55e]" />
                                                        {work.address?.street || work.pickupDetails?.address || 'Dhaka Central'}
                                                    </p>
                                                    <p className="text-xs font-medium text-[#235347]">
                                                        Estimated Weight: <span className="font-bold">{work.estimatedWeight || 1} kg</span> | Priority: <span className="uppercase font-bold">{work.priority || 'Medium'}</span>
                                                    </p>
                                                    {work.notes && <p className="text-xs italic text-gray-500 mt-1">Notes: {work.notes}</p>}
                                                </div>

                                                <div>
                                                    {isDone ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-5 py-2.5 rounded-xl border border-emerald-200">
                                                            <CheckCircle size={16} /> Completed
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCompleteAssignedWork(work._id)}
                                                            className="px-6 py-3 bg-[#22c55e] text-[#051F20] font-black rounded-xl text-xs uppercase tracking-widest hover:bg-[#051F20] hover:text-white transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-2"
                                                        >
                                                            <CheckCircle2 size={16} /> Mark as Done
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            
            case 'pickups':
                if (selectedPickup) {
                    return <PickupDetails pickup={selectedPickup} onStatusUpdate={handlePickupStatusUpdate} onBack={() => setSelectedPickup(null)} isOnline={isOnline} />;
                }
                return <PickupQueue pickups={pickups} loading={loading} error={error} onPickupSelect={setSelectedPickup} onRefresh={handleRefresh} isOnline={isOnline} />;
            
            case 'offline':
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-[#051F20]">Offline Data Center</h2>
                                <p className="text-sm font-medium text-[#8EB69B]">Manage cached operations and sync status</p>
                            </div>
                            <button onClick={loadCacheStatus} className="flex items-center space-x-2 px-5 py-2.5 bg-[#22c55e] text-[#051F20] font-bold rounded-xl hover:bg-[#051F20] hover:text-white transition-all active:scale-95 cursor-pointer shadow-md">
                                <RefreshCw className="h-4 w-4" />
                                <span>Refresh Status</span>
                            </button>
                        </div>
                        
                        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="text-center p-6 bg-[#F4F9F5] rounded-xl border border-[#22c55e]/20">
                                    <Database className="h-10 w-10 text-[#22c55e] mx-auto mb-3" />
                                    <p className="text-sm font-bold text-[#235347] uppercase tracking-wider mb-1">Secured Caches</p>
                                    <p className="text-3xl font-black text-[#051F20]">{cacheStatus?.cachedPickups || 0}</p>
                                </div>
                                <div className="text-center p-6 bg-orange-50 rounded-xl border border-orange-200">
                                    <Upload className="h-10 w-10 text-orange-500 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-1">Pending Syncs</p>
                                    <p className="text-3xl font-black text-orange-600">{cacheStatus?.pendingUpdates || 0}</p>
                                </div>
                                <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
                                    <CheckCircle className="h-10 w-10 text-blue-500 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Service Worker</p>
                                    <p className="text-xl mt-2 font-black text-blue-600">{cacheStatus?.serviceWorkerActive ? 'ACTIVE' : 'INACTIVE'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            
            case 'scanner':
                return (
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-12 text-center max-w-lg mx-auto mt-10 animate-scaleIn">
                        <div className="p-8 bg-[#F4F9F5] rounded-full w-32 h-32 mx-auto mb-8 flex items-center justify-center relative animate-float border border-[#22c55e]/20">
                            <QrCode className="h-16 w-16 text-[#22c55e]" />
                            <div className="absolute inset-0 border-4 border-[#22c55e] rounded-full animate-ping opacity-20"></div>
                        </div>
                        <h2 className="text-2xl font-bold text-[#051F20] mb-3">Initialize Scanner</h2>
                        <p className="text-sm font-medium text-[#8EB69B] mb-8 leading-relaxed">Ensure you have camera permissions enabled. Point your device at the citizen's unique QR code to instantly verify collection.</p>
                        <button className="w-full px-8 py-4 bg-[#22c55e] text-[#051F20] font-bold rounded-xl hover:bg-[#051F20] hover:text-white transition-all duration-300 active:scale-95 shadow-md hover:shadow-xl cursor-pointer flex items-center justify-center gap-2">
                            <Camera size={18} /> Launch Camera
                        </button>
                    </div>
                );
            
            default:
                return (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-lg mx-auto mt-10 animate-fadeInUp">
                        <div className="p-6 bg-gray-50 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                            <Settings className="h-10 w-10 text-gray-300 animate-spin-slow" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#051F20] mb-2">Module in Development</h2>
                        <p className="text-[#8EB69B] font-medium">Our engineering team is finalizing this feature. It will be deployed in the next update cycle.</p>
                    </div>
                );
        }
    };

    return (
        <div className={`min-h-screen bg-[#F4F9F5] flex transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            
            <Sidebar />
            
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-[#051F20]/80 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200 sticky top-0 z-30">
                    <div className="flex items-center justify-between h-24 px-4 sm:px-8">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-[#051F20] bg-[#F4F9F5] hover:bg-[#22c55e] transition-colors active:scale-90 cursor-pointer"
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <div>
                                <p className="text-xs font-bold text-[#8EB69B] uppercase tracking-wider mb-1 hidden sm:block">Dashboard View</p>
                                <h1 className="text-2xl font-bold text-[#051F20]">
                                    {activeTab === 'overview' ? 'Command Center' : 
                                     activeTab === 'assigned' ? 'Assigned Work Queue' :
                                     activeTab === 'pickups' ? (selectedPickup ? 'Pickup Routing' : 'Live Assignments') :
                                     activeTab === 'scanner' ? 'QR Verification' :
                                     activeTab === 'offline' ? 'Offline Protocols' :
                                     activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                </h1>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 sm:space-x-6">
                            {error && (
                                <div className="hidden md:flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 animate-pulse">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> {error.substring(0, 35)}...
                                </div>
                            )}

                            <button className="p-3 text-[#8EB69B] hover:text-[#22c55e] hover:bg-[#F4F9F5] rounded-xl relative transition-all active:scale-95 cursor-pointer">
                                <Bell className="h-6 w-6" />
                                <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            
                            <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>

                            <div className="flex items-center space-x-3 cursor-pointer group">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-[#051F20] group-hover:text-[#22c55e] transition-colors">{currentUser.name.split(' ')[0]}</p>
                                    <p className="text-xs font-medium text-[#8EB69B] capitalize">{currentUser.role}</p>
                                </div>
                                <div className="h-12 w-12 bg-[#F4F9F5] border-2 border-[#22c55e]/30 rounded-xl flex items-center justify-center group-hover:border-[#22c55e] transition-colors">
                                    <User className="h-6 w-6 text-[#22c55e]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                        {renderContent()}
                    </div>
                </main>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scaleUp { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes slideUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes slideDown { 0% { opacity: 0; transform: translateY(-15px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes fadeInDown { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                
                .animate-scaleUp { animation: scaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slideUp { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slideDown { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
                .animate-fadeInDown { animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-float { animation: float 4s ease-in-out infinite; }
                .animate-spin-slow { animation: spin 4s linear infinite; }

                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}