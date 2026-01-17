import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Trash2, ArrowLeft, Loader2, Search, RefreshCw, Mail, 
    Users, ShieldCheck, Truck, Clock, Zap, Eye, X, History, 
    ShieldAlert, Calendar, Phone, Fingerprint, MapPin, Coins,
    UserCheck, CreditCard, Activity, Edit3, ShieldOff, Gift, AlertTriangle,
    PlusCircle, Send, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- DUAL MODE URL CONFIG ---
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
    
    const [showDeleteModal, setShowDeleteModal] = useState({ show: false, userId: null, userName: '' });
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/api/users/all`);
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
            const res = await axios.get(`${API_BASE_URL}/api/users/activity/${user._id}`);
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
            await axios.delete(`${API_BASE_URL}/api/users/${userId}`);
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
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans relative">
            
            
            {/* --- DELETE MODAL --- */}
            {showDeleteModal.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border border-slate-100">
                        <AlertTriangle className="text-rose-500 mx-auto mb-4" size={32} />
                        <h3 className="text-xl font-bold text-slate-800 mb-1">Confirm Deletion</h3>
                        <p className="text-sm text-slate-500 mb-6 italic">
                            Terminating <span className="font-bold text-rose-600 underline">{showDeleteModal.userName}</span>
                        </p>
                        <div className="flex gap-3">
                            <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs cursor-pointer active:scale-95">Delete</button>
                            <button onClick={() => setShowDeleteModal({ show: false, userId: null, userName: '' })} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs cursor-pointer active:scale-95">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DRAWER --- */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/20 backdrop-blur-sm">
                    <div className="h-full w-full max-w-sm bg-white shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 italic uppercase">User Protocol</h2>
                            <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-slate-100 rounded-full cursor-pointer active:scale-75 transition-all"><X size={24} /></button>
                        </div>

                        <div className="text-center mb-6">
                            <div className={`h-16 w-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-black shadow-lg ${selectedUser.role === 'admin' ? "bg-rose-500" : "bg-indigo-500"}`}>
                                {selectedUser.name.charAt(0)}
                            </div>
                            <h3 className="text-lg font-black text-slate-800">{selectedUser.name}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedUser.role}</p>
                        </div>

                        <div className="space-y-2 mb-6">
                            {[
                                { label: "Email Address", val: selectedUser.email, icon: Mail },
                                { label: "Mobile Signal", val: selectedUser.mobile || "N/A", icon: Phone },
                                { label: "Credit", val: `${selectedUser.points} Pts`, icon: Coins },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <item.icon size={14} className="text-slate-400" />
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{item.label}</p>
                                        <p className="text-xs font-bold text-slate-700">{item.val}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h4>
                            {logLoading ? (
                                <Loader2 className="animate-spin text-indigo-500 mx-auto"/>
                            ) : userLogs.length > 0 ? (
                                userLogs.slice(0, 5).map(log => (
                                    <div key={log._id} className="p-3 bg-white border border-slate-100 rounded-xl">
                                        <p className="text-[10px] font-black text-slate-800 uppercase">{log.action}</p>
                                        <p className="text-[10px] text-slate-500 mt-1">{log.details}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-[10px] text-slate-300 uppercase font-black py-4">No Data</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- HEADER --- */}
            <div className="max-w-5xl mx-auto mb-6">
                {/* BACK BUTTON FIXED HERE */}
                <button onClick={() => navigate('/admin-panel')} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[9px] uppercase tracking-widest mb-4 transition-all cursor-pointer group active:scale-95">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard Hub
                </button>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase flex items-center gap-3">
                        <Users className="text-indigo-600" size={24}/> User Nodes
                    </h1>

                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                        {['all', 'citizen', 'collector', 'admin'].map((role) => (
                            <button 
                                key={role} onClick={() => setActiveRole(role)}
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap active:scale-95 ${activeRole === role ? "bg-slate-900 text-white" : "text-slate-400 hover:bg-slate-50"}`}
                            >
                                {role}s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* SEARCH */}
            <div className="max-w-5xl mx-auto flex gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input 
                        type="text"
                        placeholder="Filter by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-400 transition-all outline-none text-xs font-bold"
                    />
                </div>
                <button onClick={fetchUsers} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-indigo-500 cursor-pointer transition-all active:scale-90">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* --- LIST VIEW --- */}
            <div className="max-w-5xl mx-auto space-y-3">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={32}/></div>
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map(u => (
                        <div key={u._id} className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-4 hover:border-indigo-200 transition-all group">
                            
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center text-white font-black text-sm md:text-lg shadow-md ${u.role === 'admin' ? "bg-rose-500" : u.role === 'collector' ? "bg-blue-500" : "bg-emerald-500"}`}>
                                    {u.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{u.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 truncate mt-0.5"><Mail size={10}/> {u.email}</p>
                                </div>
                            </div>

                            <div className="hidden sm:flex flex-col items-end px-4">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <div className={`h-1.5 w-1.5 rounded-full ${u.lastLogin ? 'bg-emerald-500 shadow-sm animate-pulse' : 'bg-slate-200'}`}></div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{formatLastSeen(u.lastLogin)}</span>
                                </div>
                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">{u.activityCount || 0} Actions</p>
                            </div>

                            <div className="flex gap-1.5">
                                <button onClick={() => fetchActivity(u)} className="p-2.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all cursor-pointer active:scale-90"><Eye size={16}/></button>
                                <button onClick={() => setShowDeleteModal({ show: true, userId: u._id, userName: u.name })} className="p-2.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all cursor-pointer active:scale-90"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-[10px] text-slate-300 font-black uppercase py-20 italic">No Matching Nodes Found</p>
                )}
            </div>

            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}