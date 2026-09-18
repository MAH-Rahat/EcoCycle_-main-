import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Package, Clock, CheckCircle2, XCircle, Loader2, User, Search, 
    AlertTriangle, UserMinus, X, Menu, Leaf, LogOut, RefreshCw, MapPin
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminWasteManager() {
    const navigate = useNavigate();
    const [wasteData, setWasteData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pending'); 
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const [showSuccess, setShowSuccess] = useState('');
    const [holdModal, setHoldModal] = useState(null);
    const [rejectConfirm, setRejectConfirm] = useState(null);
    const [holdNote, setHoldNote] = useState('');

    const adminInfo = JSON.parse(localStorage.getItem('userInfo')) || { name: 'Admin' };
    const categories = ['All', 'Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic'];

    const handleFetchWaste = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/waste/legacy/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Admin Waste Data Fetched:", res.data);
            setWasteData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleFetchWaste();
        const interval = setInterval(handleFetchWaste, 10000); 
        return () => clearInterval(interval);
    }, []);

    const updateStatus = async (id, status) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/waste/legacy/status/${id}`, { 
                status, 
                note: status === 'On Hold' ? holdNote : undefined 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleFetchWaste(); 
            setShowSuccess(`${status} successfully executed!`);
            setTimeout(() => setShowSuccess(''), 3000);
            setHoldModal(null);
            setRejectConfirm(null);
        } catch (err) {
            setShowSuccess('Update failed. Please retry.');
            setTimeout(() => setShowSuccess(''), 3000);
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

    // Case-insensitive status helper checks
    const isPendingStatus = (status) => {
        const s = (status || '').toLowerCase();
        return s === 'pending';
    };

    const isHoldStatus = (status) => {
        const s = (status || '').toLowerCase();
        return s === 'on hold' || s === 'hold';
    };

    const isHistoryStatus = (status) => {
        const s = (status || '').toLowerCase();
        return ['accepted', 'rejected', 'collected', 'verified'].includes(s);
    };

    const stats = {
        pending: wasteData.filter(d => isPendingStatus(d.status)).length,
        hold: wasteData.filter(d => isHoldStatus(d.status)).length,
        history: wasteData.filter(d => isHistoryStatus(d.status)).length
    };

    const filteredData = wasteData.filter(item => {
        const categoryMatch = selectedCategory === 'All' || item.material === selectedCategory;
        const searchMatch = (item.citizen?.name || 'Deleted').toLowerCase().includes(searchQuery.toLowerCase());
        
        let tabMatch = false;
        if (activeTab === 'Pending') tabMatch = isPendingStatus(item.status);
        else if (activeTab === 'Hold') tabMatch = isHoldStatus(item.status);
        else if (activeTab === 'History') tabMatch = isHistoryStatus(item.status);

        return categoryMatch && tabMatch && searchMatch;
    });

    return (
        <div className="min-h-screen bg-[#F4F9F5] flex flex-col font-sans text-[#051F20] selection:bg-[#22c55e]/30 overflow-x-hidden">
            
            {/* SUCCESS BANNER NOTIFICATION */}
            {showSuccess && (
                <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] bg-[#051F20] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#22c55e]/30 animate-scaleIn">
                    <CheckCircle2 className="text-[#22c55e]" size={20} />
                    <span className="text-sm font-bold uppercase tracking-widest">{showSuccess}</span>
                </div>
            )}

            {/* --- TOP NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    <div className="flex items-center gap-8 lg:gap-12">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/admin-panel')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle <span className="text-xs uppercase px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] rounded border border-[#22c55e]/30">Admin</span></span>
                        </div>

                        <nav className="hidden xl:flex items-center gap-6">
                            <button onClick={() => handleNavigate('/admin-panel')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Dashboard</button>
                            <button onClick={() => handleNavigate('/admin/waste')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Waste Logs</button>
                            <button onClick={() => handleNavigate('/admin/campaigns')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Campaigns</button>
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="text-sm font-semibold text-white">{adminInfo.name}</p>
                            <p className="text-xs text-[#22c55e]">System Administrator</p>
                        </div>
                        <button onClick={handleLogout} className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                            <LogOut size={16} /> Sign Out
                        </button>
                        <button className="xl:hidden text-white hover:text-[#22c55e]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTAINER */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-10 pt-36 pb-24 space-y-8">
                
                {/* HEADER CONTEXT */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_25px_rgba(5,31,32,0.03)]">
                    <div>
                        <div className="inline-flex items-center gap-2 mb-1">
                            <Leaf size={16} className="text-[#22c55e]" />
                            <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Environmental Operations</p>
                        </div>
                        <h2 className="text-3xl font-extrabold text-[#051F20] tracking-tight">Waste Logistics Management</h2>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#22c55e]" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search citizen identity..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className="w-full pl-12 pr-6 py-3 bg-[#F4F9F5] border border-gray-200/80 rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-[#22c55e] transition-all text-[#051F20] placeholder:text-gray-400 shadow-sm" 
                            />
                        </div>
                        <button onClick={handleFetchWaste} className="p-3 bg-[#F4F9F5] border border-gray-200/80 rounded-2xl text-[#051F20] hover:bg-[#051F20] hover:text-white transition-all cursor-pointer shadow-sm" title="Refresh Logs">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </header>

                {/* TABS & CATEGORIES */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                        {['Pending', 'Hold', 'History'].map((t) => (
                            <button 
                                key={t} 
                                onClick={() => setActiveTab(t)} 
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    activeTab === t ? 'bg-[#051F20] text-white shadow-md' : 'text-[#235347] hover:bg-[#F4F9F5]'
                                }`}
                            >
                                {t} ({t === 'Pending' ? stats.pending : t === 'Hold' ? stats.hold : stats.history})
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar md:pb-0">
                        {categories.map(c => (
                            <button 
                                key={c} 
                                onClick={() => setSelectedCategory(c)} 
                                className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all shrink-0 cursor-pointer ${
                                    selectedCategory === c ? 'bg-[#22c55e] text-[#051F20] border-[#22c55e] shadow-sm' : 'bg-white text-[#235347] border-gray-200 hover:border-[#22c55e]'
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-32"><Loader2 className="animate-spin text-[#22c55e]" size={48} /></div>
                ) : filteredData.length === 0 ? (
                    <div className="py-24 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <Package className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#051F20] mb-1">No logs match criteria</h3>
                        <p className="text-sm text-[#235347]">Try switching categories or adjust your search filter.</p>
                    </div>
                ) : (
                    /* --- DATA TABLE MATRIX --- */
                    <div className="bg-white rounded-3xl shadow-[0_4px_30px_rgba(5,31,32,0.03)] border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#F4F9F5] border-b border-gray-100 text-[11px] font-bold text-[#235347] uppercase tracking-wider">
                                        <th className="py-4 px-6">Citizen Node</th>
                                        <th className="py-4 px-6">Material & Weight</th>
                                        <th className="py-4 px-6">Location</th>
                                        <th className="py-4 px-6">Timestamp</th>
                                        <th className="py-4 px-6 text-right">Operational Controls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {filteredData.map((item) => (
                                        <tr key={item._id} className="hover:bg-[#F4F9F5]/40 transition-colors group">
                                            {/* Citizen Node */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-[#F4F9F5] rounded-2xl flex items-center justify-center text-[#22c55e] border border-gray-100 shadow-sm shrink-0">
                                                        {item.citizen?.isDeleted ? <UserMinus size={16} className="text-rose-400" /> : <User size={16}/>}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[#051F20] truncate">{item.citizen?.name || 'Deleted Account'}</p>
                                                        <p className="text-[11px] font-medium text-[#8EB69B] truncate">{item.citizen?.email || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Material & Weight */}
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#051F20] text-base">{item.weight} kg</span>
                                                    <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#22c55e]/10 text-[#22c55e] rounded-full border border-[#22c55e]/20 uppercase">{item.material}</span>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td className="py-4 px-6 max-w-[220px]">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin size={14} className="text-[#22c55e] shrink-0" />
                                                    <span className="text-xs font-medium text-[#235347] truncate">{item.pickupDetails?.address || 'No Address Logged'}</span>
                                                </div>
                                            </td>

                                            {/* Timestamp */}
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <span className="text-xs font-medium text-[#8EB69B]">{new Date(item.createdAt).toLocaleDateString()}</span>
                                            </td>

                                            {/* Operational Controls */}
                                            <td className="py-4 px-6 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {activeTab === 'Pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => updateStatus(item._id, 'Accepted')} 
                                                                className="px-4 py-2 bg-[#22c55e] text-[#051F20] rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#051F20] hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button 
                                                                onClick={() => setHoldModal(item)} 
                                                                className="p-2 bg-amber-500 text-white rounded-xl hover:bg-[#051F20] transition-all cursor-pointer active:scale-95 shadow-sm"
                                                                title="Put On Hold"
                                                            >
                                                                <Clock size={16}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => setRejectConfirm(item)} 
                                                                className="p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer active:scale-95"
                                                                title="Reject"
                                                            >
                                                                <XCircle size={16}/>
                                                            </button>
                                                        </>
                                                    )}
                                                    {activeTab === 'Hold' && (
                                                        <>
                                                            <button 
                                                                onClick={() => updateStatus(item._id, 'Accepted')} 
                                                                className="px-4 py-2 bg-[#22c55e] text-[#051F20] rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#051F20] hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
                                                            >
                                                                Activate
                                                            </button>
                                                            <button 
                                                                onClick={() => setRejectConfirm(item)} 
                                                                className="p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer active:scale-95"
                                                            >
                                                                <X size={16}/>
                                                            </button>
                                                        </>
                                                    )}
                                                    {activeTab === 'History' && (
                                                        <span className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${item.status === 'Accepted' || item.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                            {item.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* FOOTER */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <Leaf size={18} className="text-[#22c55e]" />
                        <span>EcoCycle Logistics Hub</span>
                    </div>
                    <p className="text-xs text-[#8EB69B]">
                        © {new Date().getFullYear()} All Rights Reserved. Website By <span className="text-white">MAHR</span>
                    </p>
                </div>
            </footer>

            {/* MODALS */}
            {holdModal && (
                <div className="fixed inset-0 z-[150] bg-[#051F20]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-gray-100">
                        <h3 className="text-xl font-bold text-[#051F20] mb-2">Protocol: Hold Assignment</h3>
                        <p className="text-xs text-[#235347] mb-4">Provide a clear note explaining why this log is being placed on hold.</p>
                        <textarea value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="w-full bg-[#F4F9F5] border border-gray-200 rounded-2xl p-4 text-sm font-medium mb-6 outline-none focus:border-[#22c55e] text-[#051F20]" placeholder="Specific reason..." rows={3} />
                        <div className="flex gap-4">
                            <button onClick={() => updateStatus(holdModal._id, 'On Hold')} className="flex-1 bg-[#051F20] text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-[#22c55e] hover:text-[#051F20] transition-all">Save Note</button>
                            <button onClick={() => setHoldModal(null)} className="flex-1 bg-[#F4F9F5] text-[#235347] py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {rejectConfirm && (
                <div className="fixed inset-0 z-[150] bg-[#051F20]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border-t-8 border-rose-500 text-center">
                        <AlertTriangle size={40} className="mx-auto text-rose-500 mb-4 animate-bounce"/>
                        <h3 className="text-xl font-bold mb-2 uppercase text-[#051F20]">Confirm Rejection?</h3>
                        <p className="text-xs text-[#235347] mb-6">This action will mark the waste log as rejected.</p>
                        <div className="flex gap-4">
                            <button onClick={() => updateStatus(rejectConfirm._id, 'Rejected')} className="flex-1 bg-rose-600 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-rose-700 transition-all">Confirm</button>
                            <button onClick={() => setRejectConfirm(null)} className="flex-1 bg-[#F4F9F5] text-[#235347] py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all">Back</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}