import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Package, LayoutDashboard, Mountain, Clock, Camera, MapPin, 
    CheckCircle, XCircle, Loader2, User, Info, LayoutGrid, 
    List, Search, AlertTriangle, UserMinus, X, Megaphone, Gift, Users, Menu, CheckCircle2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminWasteManager() {
    const navigate = useNavigate();
    const [wasteData, setWasteData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pending'); 
    const [viewLayout, setViewLayout] = useState('grid');
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
            setShowSuccess(`${status} Successfully!`);
            setTimeout(() => setShowSuccess(''), 3000);
            setHoldModal(null);
            setRejectConfirm(null);
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
        const searchMatch = (item.citizen?.name || 'Deleted').toLowerCase().includes(searchQuery.toLowerCase());
        let tabMatch = (activeTab === 'Pending' && item.status === 'Pending') ||
                       (activeTab === 'Hold' && item.status === 'On Hold') ||
                       (activeTab === 'History' && ['Accepted', 'Rejected', 'Collected'].includes(item.status));
        return categoryMatch && tabMatch && searchMatch;
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-x-hidden">
            
            {/* SUCCESS NOTIFICATION */}
            {showSuccess && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-teal-500/30 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 className="text-teal-400" size={20} />
                    <span className="text-sm font-bold uppercase tracking-widest">{showSuccess}</span>
                </div>
            )}

            {/* NAVBAR */}
            <nav className="bg-slate-900 text-white px-4 md:px-8 py-3 shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin-panel')} className="p-2 bg-teal-600 rounded-xl hover:bg-teal-500 cursor-pointer shadow-lg active:scale-90">
                            <LayoutDashboard size={20} />
                        </button>
                        <div className="text-green-400 font-black text-lg md:text-xl tracking-tighter italic cursor-pointer hidden sm:block" onClick={() => navigate('/admin-panel')}>
                            EcoCycle Admin
                        </div>
                    </div>

                    <div className="hidden md:flex gap-6">
                        <button onClick={() => navigate('/admin-panel')} className="text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-all">Home</button>
                        <button onClick={() => navigate('/admin-waste')} className="text-sm font-bold text-white border-b-2 border-green-500 pb-0.5 cursor-pointer">Logistics</button>
                        <button onClick={() => navigate('/admin-rewards')} className="text-sm font-semibold text-slate-300 hover:text-white cursor-pointer">Rewards</button>
                        <button onClick={() => navigate('/admin-users')} className="text-sm font-semibold text-slate-300 hover:text-white cursor-pointer">Users</button>
                    </div>

                    <button className="md:hidden p-2 cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 p-6 space-y-4 border-t border-slate-800 shadow-xl">
                        <button onClick={() => {navigate('/admin-panel'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-base font-bold text-slate-300">Home</button>
                        <button onClick={() => {navigate('/admin-waste'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-base font-bold text-green-400">Logistics</button>
                        <button onClick={() => {navigate('/admin-users'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-base font-bold text-slate-300">Users</button>
                    </div>
                )}
            </nav>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-10 space-y-6">
                {/* COMPACT HEADER */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-xs font-black text-teal-600 uppercase tracking-[0.2em] mb-1">Environmental Ops</h2>
                        <p className="text-slate-900 font-black text-2xl md:text-3xl tracking-tight">Waste Logistics</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500" size={18} />
                            <input type="text" placeholder="Search identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-teal-500 transition-all" />
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner shrink-0">
                            <button onClick={() => setViewLayout('grid')} className={`p-2.5 rounded-xl cursor-pointer transition-all ${viewLayout === 'grid' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><LayoutGrid size={20} /></button>
                            <button onClick={() => setViewLayout('list')} className={`p-2.5 rounded-xl cursor-pointer transition-all ${viewLayout === 'list' ? 'bg-white text-teal-600 shadow-md' : 'text-slate-400'}`}><List size={20} /></button>
                        </div>
                    </div>
                </header>

                {/* TABS & CATEGORIES */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                        {['Pending', 'Hold', 'History'].map((t) => (
                            <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${activeTab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                {t} ({t === 'Pending' ? stats.pending : t === 'Hold' ? stats.hold : stats.history})
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar md:pb-0">
                        {categories.map(c => (
                            <button key={c} onClick={() => setSelectedCategory(c)} className={`px-5 py-2 rounded-full text-xs font-black uppercase border transition-all shrink-0 cursor-pointer ${selectedCategory === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'}`}>{c}</button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-32"><Loader2 className="animate-spin text-teal-600" size={48} /></div>
                ) : (
                    <div className={viewLayout === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                        {filteredData.map((item) => (
                            <div key={item._id} className={`bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 p-4 md:p-6 transition-all hover:border-teal-300 hover:shadow-xl flex flex-col ${viewLayout === 'list' ? 'lg:flex-row lg:items-center lg:justify-between gap-4' : 'gap-4 shadow-sm'}`}>
                                
                                {/* Info Section */}
                                <div className={`flex items-center gap-3 md:gap-4 ${viewLayout === 'list' ? 'lg:w-[25%] shrink-0' : ''}`}>
                                    <div className="h-10 w-10 md:h-12 md:w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 shadow-sm">
                                        {item.citizen?.isDeleted ? <UserMinus size={20} className="text-rose-400" /> : <User size={20}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-sm md:text-base truncate text-slate-800 uppercase tracking-tight leading-tight">{item.citizen?.name || 'Deleted Account'}</h4>
                                        <p className="text-[10px] md:text-xs text-slate-400 font-bold">{new Date(item.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Data Section */}
                                <div className={`flex items-center gap-4 md:gap-6 ${viewLayout === 'list' ? 'flex-1 min-w-0' : ''}`}>
                                    <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shrink-0">
                                        {item.photo ? <img src={item.photo} className="w-full h-full object-cover transition-transform hover:scale-110" alt="Waste" /> : <div className="h-full flex items-center justify-center text-slate-200"><Camera size={20} /></div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter">{item.weight}KG</span>
                                            <span className="text-[9px] md:text-[10px] font-black px-2 py-0.5 bg-teal-50 text-teal-600 rounded-lg border border-teal-100 uppercase">{item.material}</span>
                                        </div>
                                        <div className="flex items-start gap-1 mt-1">
                                            <MapPin size={12} className="text-teal-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] md:text-sm text-slate-500 font-semibold italic truncate leading-tight">{item.pickupDetails?.address || 'No Address Logged'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Section */}
                                <div className={`flex gap-2 shrink-0 ${viewLayout === 'list' ? 'lg:pl-4 lg:border-l border-slate-100 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0' : 'pt-4 border-t border-slate-50 mt-auto'}`}>
                                    {activeTab === 'Pending' && (
                                        <>
                                            <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-1 lg:flex-none px-5 bg-teal-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-slate-900 active:scale-95 shadow-md">Accept</button>
                                            <button onClick={() => setHoldModal(item)} className="p-2.5 bg-amber-500 text-white rounded-xl cursor-pointer hover:bg-slate-900 active:scale-95 shadow-sm"><Clock size={16}/></button>
                                            <button onClick={() => setRejectConfirm(item)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 cursor-pointer hover:bg-rose-600 hover:text-white active:scale-95"><XCircle size={16}/></button>
                                        </>
                                    )}
                                    {activeTab === 'Hold' && (
                                        <>
                                            <button onClick={() => updateStatus(item._id, 'Accepted')} className="flex-1 lg:flex-none px-6 bg-teal-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer">Activate</button>
                                            <button onClick={() => setRejectConfirm(item)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 cursor-pointer hover:bg-rose-600 hover:text-white"><X size={16}/></button>
                                        </>
                                    )}
                                    {activeTab === 'History' && (
                                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border w-full lg:w-auto text-center ${item.status === 'Accepted' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>Status: {item.status}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* MODALS */}
            {holdModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-slate-800 mb-2">Protocol: Hold</h3>
                        <textarea value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-semibold mb-6 outline-none focus:border-teal-500" placeholder="Specific reason..." rows={3} />
                        <div className="flex gap-4">
                            <button onClick={() => updateStatus(holdModal._id, 'On Hold')} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer">Save</button>
                            <button onClick={() => setHoldModal(null)} className="flex-1 bg-slate-50 text-slate-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {rejectConfirm && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl border-b-8 border-rose-500 text-center animate-in zoom-in-95">
                        <AlertTriangle size={40} className="mx-auto text-rose-500 mb-4"/>
                        <h3 className="text-xl font-black mb-2 tracking-tight uppercase italic">Confirm Rejection?</h3>
                        <div className="flex gap-4 mt-6">
                            <button onClick={() => updateStatus(rejectConfirm._id, 'Rejected')} className="flex-1 bg-rose-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer">Reject</button>
                            <button onClick={() => setRejectConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer">Back</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}