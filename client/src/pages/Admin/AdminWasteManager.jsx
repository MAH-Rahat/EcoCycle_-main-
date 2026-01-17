import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Package, LayoutDashboard, Mountain, Clock, Camera, MapPin, 
    CheckCircle, XCircle, Loader2, User, Info, LayoutGrid, 
    List, Search, AlertTriangle, UserMinus, X, Megaphone, Gift, Users
} from 'lucide-react';

// --- 1. DUAL MODE URL CONFIG ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminWasteManager() {
    const navigate = useNavigate();
    const [wasteData, setWasteData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pending'); 
    const [viewLayout, setViewLayout] = useState('grid');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [holdModal, setHoldModal] = useState(null);
    const [rejectConfirm, setRejectConfirm] = useState(null);
    const [holdNote, setHoldNote] = useState('');

    // Admin Info
    const adminInfo = JSON.parse(localStorage.getItem('userInfo')) || { name: 'Admin' };

    const categories = ['All', 'Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic'];

    const handleFetchWaste = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/all`);
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
            await axios.put(`${API_BASE_URL}/api/waste/status/${id}`, { 
                status, 
                note: status === 'On Hold' ? holdNote : undefined 
            });
            handleFetchWaste(); 
            setHoldModal(null);
            setRejectConfirm(null);
            setHoldNote('');
        } catch (err) {
            alert("Update failed.");
        }
    };

    const stats = {
        pending: wasteData.filter(d => d.status === 'Pending').length,
        hold: wasteData.filter(d => d.status === 'On Hold').length,
        history: wasteData.filter(d => ['Accepted', 'Rejected', 'Collected'].includes(d.status)).length
    };

    const filteredData = wasteData.filter(item => {
        const categoryMatch = selectedCategory === 'All' || item.material === selectedCategory;
        const searchMatch = (item.citizen?.name || 'Deleted User').toLowerCase().includes(searchQuery.toLowerCase());
        
        let tabMatch = false;
        if (activeTab === 'Pending') tabMatch = item.status === 'Pending';
        else if (activeTab === 'Hold') tabMatch = item.status === 'On Hold';
        else tabMatch = ['Accepted', 'Rejected', 'Collected'].includes(item.status);
        
        return categoryMatch && tabMatch && searchMatch;
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
            
            {/* --- 3. TOP ADMIN NAVBAR (Integrated) --- */}
            <nav className="bg-slate-900 text-white px-8 py-4 shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="text-green-400 font-bold text-xl tracking-tighter italic cursor-pointer" onClick={() => navigate('/admin-dashboard')}>
                            EcoCycle Admin
                        </div>
                        <div className="flex gap-6">
                            <button onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95">
                                <LayoutDashboard size={16} /> Home
                            </button>
                            <button onClick={() => navigate('/admin-waste')} className="flex items-center gap-2 text-sm font-bold text-white border-b-2 border-green-500 pb-1 cursor-pointer">
                                <Package size={16} /> Logistics
                            </button>
                            <button onClick={() => navigate('/admin-rewards')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95">
                                <Gift size={16} /> Rewards
                            </button>
                            <button onClick={() => navigate('/admin-campaigns')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95">
                                <Megaphone size={16} /> Campaigns
                            </button>
                            <button onClick={() => navigate('/admin-users')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95">
                                <Users size={16} /> User Nodes
                            </button>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{adminInfo.name}</div>
                </div>
            </nav>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR (Preserved) */}
                <aside className="w-72 bg-[#0F172A] text-slate-400 flex flex-col shrink-0 border-r border-slate-800 hidden lg:flex">
                    <div className="p-8">
                        <nav className="space-y-3">
                            <button onClick={() => navigate('/admin-dashboard')} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/5 rounded-2xl transition-all font-bold text-base cursor-pointer active:scale-95">
                                <LayoutDashboard size={20} /> Dashboard
                            </button>
                            <button className="w-full flex items-center gap-4 px-6 py-4 bg-teal-600 text-white rounded-2xl transition shadow-xl font-bold text-base cursor-default">
                                <Package size={20} /> Waste Logistics
                            </button>
                        </nav>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="flex-1 flex flex-col overflow-y-auto">
                    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 md:px-10 py-6 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4">
                        <div className="flex items-center gap-8 w-full md:w-auto">
                            <div>
                                <h2 className="text-xs font-black text-teal-600 uppercase tracking-[0.2em] mb-1">Logistics Hub</h2>
                                <p className="text-slate-900 font-black text-3xl tracking-tight">Waste Management</p>
                            </div>
                            
                            <div className="relative group hidden xl:block">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search citizen..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 pr-6 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-teal-500 rounded-2xl text-sm font-bold w-80 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                            {/* --- 2. CURSOR POINTERS ADDED TO ALL BUTTONS --- */}
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                                <button onClick={() => setViewLayout('grid')} className={`p-2.5 rounded-xl transition-all cursor-pointer ${viewLayout === 'grid' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><LayoutGrid size={20} /></button>
                                <button onClick={() => setViewLayout('list')} className={`p-2.5 rounded-xl transition-all cursor-pointer ${viewLayout === 'list' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><List size={20} /></button>
                            </div>

                            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
                                {['Pending', 'Hold', 'History'].map((t) => (
                                    <button key={t} onClick={() => setActiveTab(t)} className={`px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${activeTab === t ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {t} <span className="ml-1 opacity-50">({t === 'Pending' ? stats.pending : t === 'Hold' ? stats.hold : stats.history})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-8">
                        {/* Category Filter */}
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            {categories.map(c => (
                                <button key={c} onClick={() => setSelectedCategory(c)} className={`px-6 py-3 rounded-full text-sm font-bold border transition-all shrink-0 cursor-pointer ${selectedCategory === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-32"><Loader2 className="animate-spin text-teal-600" size={48} /></div>
                        ) : filteredData.length === 0 ? (
                            <div className="bg-white rounded-[3rem] p-24 text-center border border-slate-200 shadow-sm">
                                <Info size={64} className="mx-auto text-slate-200 mb-6" />
                                <p className="text-slate-500 font-bold text-xl uppercase tracking-widest">No matching records found</p>
                            </div>
                        ) : viewLayout === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {filteredData.map((item) => (
                                    <div key={item._id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 hover:shadow-2xl hover:border-teal-200 transition-all flex flex-col group relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 transition-colors border border-slate-100">
                                                    {item.citizen?.isDeleted ? <UserMinus size={24} className="text-rose-400" /> : <User size={24}/>}
                                                </div>
                                                <div>
                                                    <h4 className={`font-black text-lg tracking-tight leading-none mb-1 ${item.citizen?.isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>
                                                        {item.citizen?.name || 'Deleted Account'}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 font-bold">{new Date(item.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="bg-teal-50 text-teal-700 text-[11px] font-black px-4 py-2 rounded-full uppercase border border-teal-100">{item.material}</div>
                                        </div>

                                        <div className="flex gap-6 mb-8">
                                            <div className="w-28 h-28 bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 shrink-0">
                                                {item.photo ? <img src={item.photo} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Waste" /> : <div className="h-full flex items-center justify-center text-slate-200"><Camera size={32} /></div>}
                                            </div>
                                            <div className="flex flex-col justify-center space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Density</p>
                                                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{item.weight} <span className="text-sm text-slate-300 uppercase font-black">kg</span></p>
                                                </div>
                                                <div className="flex items-start gap-2 max-w-[180px]">
                                                    <MapPin size={16} className="text-teal-500 shrink-0 mt-0.5" />
                                                    <p className="text-sm text-slate-500 font-semibold italic line-clamp-2 leading-snug">
                                                        {item.pickupDetails?.address || 'Address Not Provided'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-auto flex gap-3 pt-6 border-t border-slate-100">
                                            {activeTab === 'Pending' && (
                                                <>
                                                    <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-[2] bg-teal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-teal-100 cursor-pointer">Accept</button>
                                                    <button onClick={() => setHoldModal(item)} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-amber-100 cursor-pointer">Hold</button>
                                                    <button onClick={() => setRejectConfirm(item)} className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-rose-600 hover:text-white border border-rose-100 cursor-pointer">Reject</button>
                                                </>
                                            )}
                                            {activeTab === 'Hold' && (
                                                <>
                                                    <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-1 bg-teal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer">Accept Request</button>
                                                    <button onClick={() => setRejectConfirm(item)} className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white border border-rose-100 cursor-pointer">Reject</button>
                                                </>
                                            )}
                                            {activeTab === 'History' && (
                                                <div className={`w-full py-4 rounded-2xl text-center font-black text-xs uppercase tracking-[0.2em] border shadow-sm ${item.status === 'Accepted' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                    Archive: {item.status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Citizen</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Type</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Mass</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Address</th>
                                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map((item) => (
                                            <tr key={item._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                            {item.citizen?.isDeleted ? <UserMinus size={18} className="text-rose-400" /> : <User size={18}/>}
                                                        </div>
                                                        <div>
                                                            <p className={`font-black text-base leading-none mb-1 ${item.citizen?.isDeleted ? 'text-rose-500' : 'text-slate-800'}`}>
                                                                {item.citizen?.name || 'Deleted Account'}
                                                            </p>
                                                            <p className="text-xs text-slate-400 font-bold">{new Date(item.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase border border-slate-200">{item.material}</span>
                                                </td>
                                                <td className="px-8 py-6 text-center font-black text-xl text-slate-800">{item.weight} <span className="text-[10px] text-slate-400">KG</span></td>
                                                <td className="px-8 py-6 max-w-xs text-sm font-semibold text-slate-500 truncate italic">
                                                    {item.pickupDetails?.address || 'N/A'}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    {activeTab === 'History' ? (
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border ${item.status === 'Accepted' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                            {item.status}
                                                        </span>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => updateStatus(item._id, 'Accepted')} className="p-2.5 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all shadow-sm cursor-pointer"><CheckCircle size={20}/></button>
                                                            <button onClick={() => setHoldModal(item)} className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm cursor-pointer"><Clock size={20}/></button>
                                                            <button onClick={() => setRejectConfirm(item)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer"><XCircle size={20}/></button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* HOLD MODAL */}
                    {holdModal && (
                        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl animate-in zoom-in-95 duration-200">
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Move to Hold</h3>
                                <textarea value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-5 text-base font-semibold mb-8 outline-none focus:border-teal-500" placeholder="Note for citizen..." rows={4} />
                                <div className="flex gap-4">
                                    <button onClick={() => updateStatus(holdModal._id, 'On Hold')} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 cursor-pointer">Confirm</button>
                                    <button onClick={() => setHoldModal(null)} className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer">Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* REJECT MODAL */}
                    {rejectConfirm && (
                        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl border-b-8 border-rose-500 animate-in zoom-in-95 duration-200">
                                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40}/></div>
                                <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Final Rejection?</h3>
                                <p className="text-base text-slate-500 text-center mb-8 font-medium italic">
                                    "{rejectConfirm.citizen?.name}" record will move to History as Rejected.
                                </p>
                                <div className="flex gap-4">
                                    <button onClick={() => updateStatus(rejectConfirm._id, 'Rejected')} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-rose-200 cursor-pointer">Reject Now</button>
                                    <button onClick={() => setRejectConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer">Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}