import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Trash2, ArrowLeft, Loader2, Search, RefreshCw, Mail, 
    Users, ShieldCheck, Truck, Clock, Zap, Eye, X, History, 
    ShieldAlert, Calendar, Phone, Fingerprint, MapPin, Coins,
    UserCheck, CreditCard, Activity, Edit3, ShieldOff, Gift, AlertTriangle,
    PlusCircle, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserManager() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userLogs, setUserLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRole, setActiveRole] = useState('all');
    const [loading, setLoading] = useState(true);
    const [logLoading, setLogLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Custom Modal State
    const [showDeleteModal, setShowDeleteModal] = useState({ show: false, userId: null, userName: '' });

    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.get(`${apiUrl}/api/users/all`);
            setUsers(Array.isArray(res.data) ? res.data : []);
            setError(null);
        } catch (err) {
            setError("Could not load users database.");
        } finally {
            setLoading(false);
        }
    };

    const fetchActivity = async (user) => {
        setSelectedUser(user);
        setLogLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.get(`${apiUrl}/api/users/activity/${user._id}`);
            setUserLogs(res.data);
        } catch (err) {
            setUserLogs([]);
        } finally {
            setLogLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const confirmDelete = async () => {
        const { userId } = showDeleteModal;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await axios.delete(`${apiUrl}/api/users/${userId}`);
            setUsers(users.filter(u => u._id !== userId));
            setShowDeleteModal({ show: false, userId: null, userName: '' });
        } catch (err) {
            alert("Action failed. Check server connection.");
        }
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
        <div className="p-8 bg-slate-50 min-h-screen font-sans relative">
            
            {/* --- 1. CUSTOM DELETE MODAL --- */}
            {showDeleteModal.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-indigo-900/20 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-rose-100 text-center scale-up-center">
                        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Are you sure?</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed italic">
                            Terminating <span className="font-bold text-rose-600 underline">{showDeleteModal.userName}'s</span> account is a permanent action.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button onClick={confirmDelete} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-600 active:scale-95 transition-all shadow-lg shadow-rose-200">Confirm Deletion</button>
                            <button onClick={() => setShowDeleteModal({ show: false, userId: null, userName: '' })} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 active:scale-95 transition-all">Cancel Action</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 2. DRAWER --- */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex justify-end bg-indigo-900/10 backdrop-blur-sm transition-opacity duration-300">
                    <div className="h-full w-full max-w-md bg-white shadow-2xl p-8 overflow-y-auto transform transition-all animate-in slide-in-from-right duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="text-indigo-600" size={24} />
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Admin Control</h2>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-indigo-50 rounded-full active:scale-75 transition-all">
                                <X size={28} className="text-indigo-400" />
                            </button>
                        </div>

                        {/* Profile Identity Card */}
                        <div className="text-center mb-8">
                            <div className="h-24 w-24 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-[2rem] mx-auto mb-4 flex items-center justify-center text-white text-4xl font-black shadow-xl ring-8 ring-indigo-50">
                                {selectedUser.name.charAt(0)}
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 leading-tight">{selectedUser.name}</h3>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">{selectedUser.role}</p>
                            
                            <div className="flex justify-center gap-3 mt-6">
                                <button className="flex-1 py-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all active:scale-90 font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-amber-100"><Gift size={14}/> Reward</button>
                                <button className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all active:scale-90 font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-rose-100"><ShieldOff size={14}/> Suspend</button>
                            </div>
                        </div>

                        {/* Information Section */}
                        <div className="space-y-3 mb-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 underline underline-offset-4 decoration-indigo-200">
                                <Fingerprint size={14} /> Account Meta Data
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { label: "Direct Email", val: selectedUser.email, icon: Mail },
                                    { label: "Phone Line", val: selectedUser.mobile || "N/A", icon: Phone },
                                    { label: "Unique Username", val: selectedUser.username, icon: Users },
                                    { label: "Wallet Balance", val: `${selectedUser.points} EcoCoins`, icon: Coins },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
                                        <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-500"><item.icon size={16} /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{item.label}</p>
                                            <p className="text-sm font-bold text-slate-700">{item.val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Audit Logs */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={14} /> Activity Stream</h4>
                            {logLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500"/></div>
                            ) : userLogs.length > 0 ? (
                                userLogs.map(log => (
                                    <div key={log._id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-200 group-hover:bg-indigo-500 transition-colors"></div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{log.action}</p>
                                        <p className="text-xs text-slate-500 mt-1">{log.details}</p>
                                        <p className="text-[9px] text-slate-400 mt-2 font-bold">{new Date(log.createdAt).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 border-2 border-dashed border-slate-100 rounded-3xl text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">End of Records</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- 3. HEADER AREA --- */}
            <div className="max-w-7xl mx-auto mb-10">
                <button 
                    onClick={() => navigate('/admin-panel')} 
                    className="group flex items-center gap-3 text-slate-400 hover:text-indigo-600 font-black mb-8 transition-all active:scale-95"
                >
                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300">
                        <ArrowLeft size={18}/> 
                    </div>
                    <span className="tracking-widest text-[10px]">BACK TO DASHBOARD</span>
                </button>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-5">
                            <div className="p-4 bg-indigo-600 rounded-[1.8rem] shadow-2xl shadow-indigo-200 rotate-3 group hover:rotate-0 transition-transform">
                                <Users className="text-white" size={38}/>
                            </div>
                            Control Center
                        </h1>
                        <p className="text-slate-400 mt-5 font-bold uppercase text-[10px] tracking-[0.3em] ml-2">Administrative User Oversight & Integrity</p>
                    </div>

                    <div className="flex bg-white p-2 rounded-[1.8rem] border border-slate-200 shadow-xl shadow-indigo-100/20">
                        {['all', 'citizen', 'collector', 'admin'].map((role) => (
                            <button 
                                key={role} onClick={() => setActiveRole(role)}
                                className={`px-7 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all active:scale-90 ${activeRole === role ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200" : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"}`}
                            >
                                {role}s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-5 mb-10">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20}/>
                    <input 
                        type="text"
                        placeholder="Search Identity or Database ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-white border border-slate-200 rounded-[2.2rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all outline-none shadow-sm text-slate-700 font-bold placeholder:text-slate-300"
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchUsers} className="p-5 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:bg-indigo-50 hover:text-indigo-500 transition-all active:scale-90 shadow-sm">
                        <RefreshCw size={24} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button className="flex items-center gap-3 px-8 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 hover:shadow-xl shadow-indigo-200 transition-all active:scale-95">
                        <PlusCircle size={20}/> Offer Everyone
                    </button>
                </div>
            </div>

            {/* --- 4. DATA TABLE --- */}
            <div className="max-w-7xl mx-auto bg-white rounded-[3.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-900/95 text-slate-400 uppercase text-[9px] font-black tracking-[0.3em]">
                                <th className="p-9">Identification</th>
                                <th className="p-9 text-center">Actions Count</th>
                                <th className="p-9">Joining Date</th>
                                <th className="p-9">Status</th>
                                <th className="p-9 text-right">Master Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredUsers.map(u => (
                                <tr key={u._id} className="group hover:bg-indigo-50/40 transition-all duration-300">
                                    <td className="p-7">
                                        <div className="flex items-center gap-6">
                                            <div className={`h-16 w-16 rounded-[1.6rem] flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:scale-105 transition-transform ${u.role === 'admin' ? "bg-rose-500" : u.role === 'collector' ? "bg-blue-500" : "bg-emerald-500"}`}>
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{u.name}</p>
                                                <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 mt-1.5"><Mail size={12} className="text-slate-300"/> {u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-7 text-center">
                                        <div className="inline-flex flex-col items-center p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 group-hover:bg-white group-hover:border-indigo-100 transition-all">
                                            <span className="text-xl font-black text-indigo-600 flex items-center gap-1.5">
                                                <Zap size={18} className="fill-indigo-600"/> {u.activityCount || 0}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-7">
                                        <div className="flex items-center gap-2 text-slate-500 font-black text-xs uppercase">
                                            <Calendar size={15} className="text-indigo-200" />
                                            {new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="p-7">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2.5 w-2.5 rounded-full ${u.lastLogin ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-100/50' : 'bg-slate-200'}`}></div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatLastSeen(u.lastLogin)}</p>
                                        </div>
                                    </td>
                                    <td className="p-7 text-right">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => fetchActivity(u)} className="p-4 bg-indigo-50 text-indigo-400 rounded-[1.2rem] hover:bg-indigo-600 hover:text-white transition-all active:scale-75 shadow-sm border border-indigo-100/50" title="Full Activity"><Eye size={20}/></button>
                                            <button onClick={() => fetchActivity(u)} className="p-4 bg-amber-50 text-amber-400 rounded-[1.2rem] hover:bg-amber-500 hover:text-white transition-all active:scale-75 shadow-sm border border-amber-100/50" title="Quick Actions"><ShieldCheck size={20}/></button>
                                            <button onClick={() => setShowDeleteModal({ show: true, userId: u._id, userName: u.name })} className="p-4 bg-rose-50 text-rose-400 rounded-[1.2rem] hover:bg-rose-500 hover:text-white transition-all active:scale-75 shadow-sm border border-rose-100/50" title="Delete Account"><Trash2 size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .scale-up-center { animation: scale-up-center 0.2s cubic-bezier(0.390, 0.575, 0.565, 1.000) both; }
                @keyframes scale-up-center { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}