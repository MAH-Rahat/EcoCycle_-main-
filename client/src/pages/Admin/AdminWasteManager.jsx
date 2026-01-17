import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Package, LayoutDashboard, Mountain, Clock, Camera, MapPin, 
    CheckCircle, XCircle, Loader2, User, Info, LayoutGrid, 
    List, Search, AlertTriangle, UserMinus, X
} from 'lucide-react';

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

    const categories = ['All', 'Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic'];

    const handleFetchWaste = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.get(`${apiUrl}/api/waste/all`);
            setWasteData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleFetchWaste();
        const interval = setInterval(handleFetchWaste, 10000); // Sync every 10s for multiple admins
        return () => clearInterval(interval);
    }, []);

    const updateStatus = async (id, status) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await axios.put(`${apiUrl}/api/waste/status/${id}`, { 
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
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900">
            {/* SIDEBAR */}
            <aside className="w-72 bg-[#0F172A] text-slate-400 flex flex-col shrink-0 border-r border-slate-800">
                <div className="p-8">
                    <div className="flex items-center gap-3 text-white mb-12">
                        <div className="bg-teal-600 p-2.5 rounded-2xl shadow-lg shadow-teal-900/40"><Mountain size={24} /></div>
                        <span className="text-2xl font-black tracking-tighter uppercase italic">EcoCycle</span>
                    </div>
                    <nav className="space-y-3">
                        <button onClick={() => navigate('/admin-panel')} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/5 rounded-2xl transition-all font-bold text-base">
                            <LayoutDashboard size={20} /> Dashboard
                        </button>
                        <button className="w-full flex items-center gap-4 px-6 py-4 bg-teal-600 text-white rounded-2xl transition shadow-xl font-bold text-base">
                            <Package size={20} /> Waste Logistics
                        </button>
                    </nav>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-10 py-6 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-8">
                        <div>
                            <h2 className="text-xs font-black text-teal-600 uppercase tracking-[0.2em] mb-1">Logistics Hub</h2>
                            <p className="text-slate-900 font-black text-3xl tracking-tight">Waste Management</p>
                        </div>
                        
                        {/* SEARCH BAR */}
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

                    <div className="flex items-center gap-6">
                        {/* LIST/GRID TOGGLE */}
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <button onClick={() => setViewLayout('grid')} className={`p-2.5 rounded-xl transition-all ${viewLayout === 'grid' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><LayoutGrid size={20} /></button>
                            <button onClick={() => setViewLayout('list')} className={`p-2.5 rounded-xl transition-all ${viewLayout === 'list' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><List size={20} /></button>
                        </div>

                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            {['Pending', 'Hold', 'History'].map((t) => (
                                <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === t ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {t} <span className="ml-1 opacity-50">({t === 'Pending' ? stats.pending : t === 'Hold' ? stats.hold : stats.history})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="p-10 max-w-[1440px] mx-auto w-full space-y-8">
                    {/* Category Filter */}
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {categories.map(c => (
                            <button key={c} onClick={() => setSelectedCategory(c)} className={`px-6 py-3 rounded-full text-sm font-bold border transition-all shrink-0 ${selectedCategory === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'}`}>
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
                                                <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-[2] bg-teal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-teal-100">Accept</button>
                                                <button onClick={() => setHoldModal(item)} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-amber-100">Hold</button>
                                                <button onClick={() => setRejectConfirm(item)} className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-rose-600 hover:text-white border border-rose-100">Reject</button>
                                            </>
                                        )}
                                        {activeTab === 'Hold' && (
                                            <>
                                                <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-1 bg-teal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Accept Request</button>
                                                <button onClick={() => setRejectConfirm(item)} className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white border border-rose-100">Reject</button>
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
                        /* LIST VIEW */
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
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
                                                        <button onClick={() => updateStatus(item._id, 'Accepted')} className="p-2.5 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all shadow-sm"><CheckCircle size={20}/></button>
                                                        <button onClick={() => setHoldModal(item)} className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"><Clock size={20}/></button>
                                                        <button onClick={() => setRejectConfirm(item)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><XCircle size={20}/></button>
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
                        <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Move to Hold</h3>
                            <textarea value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-5 text-base font-semibold mb-8 outline-none focus:border-teal-500" placeholder="Note for citizen..." rows={4} />
                            <div className="flex gap-4">
                                <button onClick={() => updateStatus(holdModal._id, 'On Hold')} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95">Confirm</button>
                                <button onClick={() => setHoldModal(null)} className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* REJECT MODAL */}
                {rejectConfirm && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl border-b-8 border-rose-500">
                            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40}/></div>
                            <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Final Rejection?</h3>
                            <p className="text-base text-slate-500 text-center mb-8 font-medium italic">
                                "{rejectConfirm.citizen?.name}" record will move to History as Rejected.
                            </p>
                            <div className="flex gap-4">
                                <button onClick={() => updateStatus(rejectConfirm._id, 'Rejected')} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-rose-200">Reject Now</button>
                                <button onClick={() => setRejectConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}