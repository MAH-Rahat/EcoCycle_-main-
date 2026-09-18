import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Trash2, ArrowLeft, Loader2, Search, RefreshCw, Mail, 
    Users, ShieldCheck, Truck, Clock, Zap, Eye, X, History, 
    ShieldAlert, Calendar, Phone, Fingerprint, MapPin, Coins,
    UserCheck, CreditCard, Activity, Edit3, ShieldOff, Gift, AlertTriangle,
    PlusCircle, Send, ChevronRight, Leaf, LogOut, Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function UserManager() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userLogs, setUserLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRole, setActiveRole] = useState('all');
    const [loading, setLoading] = useState(true);
    const [logLoading, setLogLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const [showDeleteModal, setShowDeleteModal] = useState({ show: false, userId: null, userName: '' });
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/users/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = res.data.users || res.data || [];
            setUsers(Array.isArray(userData) ? userData : []);
            setError(null);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError("Could not load users database.");
        } finally {
            setLoading(false);
        }
    };

    const fetchActivity = async (user) => {
        setSelectedUser(user);
        setLogLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/users/activity/${user._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const logs = res.data.logs || res.data || [];
            setUserLogs(Array.isArray(logs) ? logs : []);
        } catch (err) {
            console.error('Error fetching activity:', err);
            setUserLogs([]);
        } finally {
            setLogLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const confirmDelete = async () => {
        const { userId } = showDeleteModal;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(users.filter(u => u._id !== userId));
            setShowDeleteModal({ show: false, userId: null, userName: '' });
        } catch (err) {
            console.error('Error deleting user:', err);
            alert("Action failed. Check server connection.");
        }
    };

    const handleNavigate = (path) => {
        if (window.location.pathname === path) return;
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = activeRole === 'all' || u.role === activeRole;
        return matchesSearch && matchesRole;
    });

    const formatLastSeen = (date) => {
        if (!date) return "Never";
        const now = new Date();
        const diff = Math.floor((now - new Date(date)) / 1000);
        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(date).toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-[#F4F9F5] font-sans text-[#051F20] flex flex-col overflow-x-hidden selection:bg-[#22c55e]/30">
            
            {/* --- DEEP ECO NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    
                    <div className="flex items-center gap-8 lg:gap-12">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/admin-panel')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle <span className="text-xs uppercase px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] rounded border border-[#22c55e]/30">Admin</span></span>
                        </div>

                        {/* NAVBAR LINKS */}
                        <nav className="hidden xl:flex items-center gap-6">
                            <button onClick={() => handleNavigate('/admin-panel')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Dashboard</button>
                            <button onClick={() => handleNavigate('/admin/waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Waste Logs</button>
                            <button onClick={() => handleNavigate('/admin/campaigns')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Campaigns</button>
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="text-sm font-semibold text-white">{JSON.parse(localStorage.getItem('userInfo'))?.name || 'Admin'}</p>
                            <p className="text-xs text-[#22c55e]">System Administrator</p>
                        </div>

                        <button 
                            onClick={handleLogout}
                            className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                        
                        <button className="xl:hidden text-white hover:text-[#22c55e] active:scale-90 transition-all cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* MOBILE MENU DROPDOWN */}
            {isMobileMenuOpen && (
                <div className="xl:hidden fixed inset-0 z-[150] bg-[#051F20] pt-28 px-6 animate-fadeIn overflow-y-auto pb-12">
                    <button className="absolute top-8 right-6 text-white hover:text-[#22c55e]" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={32} />
                    </button>
                    <div className="flex flex-col gap-4">
                        <button onClick={() => { handleNavigate('/admin-panel'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Dashboard</button>
                        <button onClick={() => { handleNavigate('/admin/waste'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Waste Logistics</button>
                        <button onClick={() => { handleNavigate('/admin/campaigns'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Campaigns</button>
                        <button onClick={() => { handleNavigate('/admin/rewards'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Rewards Engine</button>
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            <main className="flex-1 max-w-5xl mx-auto w-full px-4 lg:px-10 pt-36 pb-24 space-y-8">
                
                {/* --- DELETE MODAL --- */}
                {showDeleteModal.show && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#051F20]/80 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-gray-100 animate-scaleIn">
                            <AlertTriangle className="text-rose-500 mx-auto mb-4" size={36} />
                            <h3 className="text-xl font-bold text-[#051F20] mb-2">Confirm Deletion</h3>
                            <p className="text-xs text-[#235347] mb-6 leading-relaxed">
                                Terminating <span className="font-bold text-rose-600 underline">{showDeleteModal.userName}</span>
                            </p>
                            <div className="flex gap-3">
                                <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-sm">Delete</button>
                                <button onClick={() => setShowDeleteModal({ show: false, userId: null, userName: '' })} className="flex-1 py-3 bg-[#F4F9F5] text-[#235347] rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DRAWER --- */}
                {selectedUser && (
                    <div className="fixed inset-0 z-[120] flex justify-end bg-[#051F20]/80 backdrop-blur-sm animate-fadeIn">
                        <div className="h-full w-full max-w-sm bg-white shadow-2xl p-8 overflow-y-auto animate-slideRight">
                            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-[#051F20]">User Protocol</h2>
                                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-[#F4F9F5] rounded-full cursor-pointer active:scale-75 transition-all text-gray-400 hover:text-[#051F20]"><X size={22} /></button>
                            </div>

                            <div className="text-center mb-8">
                                <div className={`h-20 w-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold shadow-md ${selectedUser.role === 'admin' ? "bg-rose-500" : selectedUser.role === 'collector' ? "bg-blue-500" : "bg-[#22c55e]"}`}>
                                    {selectedUser.name.charAt(0)}
                                </div>
                                <h3 className="text-lg font-bold text-[#051F20]">{selectedUser.name}</h3>
                                <p className="text-xs text-[#22c55e] font-bold uppercase tracking-wider mt-1">{selectedUser.role}</p>
                            </div>

                            <div className="space-y-3 mb-8">
                                {[
                                    { label: "Email Address", val: selectedUser.email, icon: Mail },
                                    { label: "Mobile Signal", val: selectedUser.mobile || "N/A", icon: Phone },
                                    { label: "Credit", val: `${selectedUser.points} Pts`, icon: Coins },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-[#F4F9F5] rounded-xl border border-gray-100">
                                        <item.icon size={16} className="text-[#22c55e]" />
                                        <div>
                                            <p className="text-[10px] font-bold text-[#8EB69B] uppercase tracking-wider leading-none mb-1">{item.label}</p>
                                            <p className="text-xs font-bold text-[#051F20]">{item.val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-[#235347] uppercase tracking-wider">Recent Activity</h4>
                                {logLoading ? (
                                    <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#22c55e]" size={24}/></div>
                                ) : userLogs.length > 0 ? (
                                    userLogs.slice(0, 5).map(log => (
                                        <div key={log._id} className="p-4 bg-[#F4F9F5] border border-gray-100 rounded-xl">
                                            <p className="text-xs font-bold text-[#051F20] uppercase">{log.action}</p>
                                            <p className="text-xs text-[#235347] mt-1 font-medium">{log.details}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-xs text-[#8EB69B] font-bold uppercase py-6">No Activity Logs Found</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- HEADER --- */}
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(5,31,32,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeInUp opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-[#F4F9F5] rounded-xl text-[#22c55e]">
                            <Users size={24}/>
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 mb-1">
                                <Leaf size={14} className="text-[#22c55e]" />
                                <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Node Management</p>
                            </div>
                            <h1 className="text-3xl font-bold text-[#051F20] tracking-tight">User Nodes Directory</h1>
                        </div>
                    </div>

                    <div className="flex bg-[#F4F9F5] p-1.5 rounded-2xl border border-gray-200 shadow-inner overflow-x-auto no-scrollbar">
                        {['all', 'citizen', 'collector', 'admin'].map((role) => (
                            <button 
                                key={role} onClick={() => setActiveRole(role)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95 ${activeRole === role ? "bg-[#051F20] text-white shadow-sm" : "text-[#235347] hover:bg-gray-200"}`}
                            >
                                {role}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* SEARCH */}
                <div className="flex gap-4 animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                        <input 
                            type="text"
                            placeholder="Filter by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all outline-none text-sm font-medium text-[#051F20] shadow-[0_4px_20px_rgba(5,31,32,0.02)]"
                        />
                    </div>
                    <button onClick={fetchUsers} className="p-3.5 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-[#22c55e] cursor-pointer transition-all active:scale-90 shadow-sm">
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* --- LIST VIEW --- */}
                <div className="space-y-4 animate-slideUp opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                    {loading ? (
                        <div className="flex justify-center py-32"><Loader2 className="animate-spin text-[#22c55e]" size={40}/></div>
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((u, idx) => (
                            <div 
                                key={u._id} 
                                className="bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgba(5,31,32,0.03)] border border-gray-100 flex items-center justify-between gap-6 hover:border-[#22c55e]/40 hover:shadow-md transition-all group"
                                style={{ animationDelay: `${0.3 + (idx * 0.05)}s` }}
                            >
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm ${u.role === 'admin' ? "bg-rose-500" : u.role === 'collector' ? "bg-blue-500" : "bg-[#22c55e]"}`}>
                                        {u.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-800 text-base truncate tracking-tight">{u.name}</h3>
                                        <p className="text-xs font-medium text-[#8EB69B] flex items-center gap-1.5 truncate mt-0.5"><Mail size={12}/> {u.email}</p>
                                    </div>
                                </div>

                                <div className="hidden sm:flex flex-col items-end px-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className={`h-2 w-2 rounded-full ${u.lastLogin ? 'bg-[#22c55e] shadow-sm animate-pulse' : 'bg-gray-200'}`}></div>
                                        <span className="text-[10px] font-bold text-[#8EB69B] uppercase tracking-wider">{formatLastSeen(u.lastLogin)}</span>
                                    </div>
                                    <p className="text-xs font-bold text-[#235347] uppercase">{u.activityCount || 0} Actions</p>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => fetchActivity(u)} className="p-3 bg-[#F4F9F5] text-[#235347] rounded-xl hover:bg-[#22c55e] hover:text-[#051F20] transition-all cursor-pointer active:scale-90 shadow-sm" title="View Details"><Eye size={18}/></button>
                                    <button onClick={() => setShowDeleteModal({ show: true, userId: u._id, userName: u.name })} className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer active:scale-90 shadow-sm" title="Terminate Node"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <Users className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-[#051F20] mb-1">No Matching Nodes Found</h3>
                            <p className="text-sm text-[#235347]">Try adjusting your search criteria or role filter.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* --- FOOTER --- */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Leaf size={18} className="text-[#22c55e]" />
                            <span>EcoCycle User Directory</span>
                        </div>
                        <p className="text-xs text-[#8EB69B] mt-1">© {new Date().getFullYear()} All Rights Reserved.</p>
                    </div>

                    <div className="text-center md:text-right">
                        <p className="text-xs font-semibold text-[#8EB69B]">
                            Website By <span className="text-white">MAHR</span>
                        </p>
                    </div>
                </div>
            </footer>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .animate-fadeInUp { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-slideUp { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-slideRight { animation: slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }

                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}