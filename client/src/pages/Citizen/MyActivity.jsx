import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Truck, Package, Clock, CheckCircle, Leaf, XCircle, Search, 
    Filter, Zap, ChevronDown, Menu, X, LogOut, Globe, Activity, UserCircle, Bell, Settings
} from 'lucide-react';
import RequestPickup from './RequestPickup'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MyActivity() {
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedWasteId, setSelectedWasteId] = useState(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userStats, setUserStats] = useState({ points: 0 });
    const dropdownRef = useRef(null);

    const userInfoString = localStorage.getItem('userInfo');
    const user = userInfoString ? JSON.parse(userInfoString) : null;
    const isAdmin = user?.role === 'admin';

    const fetchActivity = async () => {
        if (!user || !user._id) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/user/${user._id}`);
            setActivities(res.data);
            setFilteredActivities(res.data);
            const statsRes = await axios.get(`${API_BASE_URL}/api/waste/stats/${user._id}`);
            setUserStats(statsRes.data);
        } catch (error) { console.error("Fetch failed"); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (!user) { navigate('/login'); } else { fetchActivity(); }
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        let result = activities;
        if (activeFilter === 'Schedule') result = result.filter(item => item.status === 'Accepted');
        else if (activeFilter !== 'All') result = result.filter(item => item.status === activeFilter);
        if (searchTerm) result = result.filter(item => item.material.toLowerCase().includes(searchTerm.toLowerCase()));
        setFilteredActivities(result);
    }, [activeFilter, searchTerm, activities]);

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/');
    };

    const handleOpenPickup = (id) => {
        setSelectedWasteId(id);
        setShowModal(true);
    };

    const FilterButton = ({ label, count }) => (
        <button 
            onClick={() => setActiveFilter(label)}
            className={`px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0
            ${activeFilter === label ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
        >
            {label} {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeFilter === label ? 'bg-[#4CAF50] text-white' : 'bg-slate-100'}`}>{count}</span>}
        </button>
    );

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-white">
            <div className="w-10 h-10 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col overflow-x-hidden text-slate-900">
            
            {/* --- MASTER NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 h-full flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/home')}>
                            <div className="bg-[#4CAF50] p-1.5 rounded-lg group-hover:rotate-12 transition-transform"><Leaf className="text-white h-5 w-5" /></div>
                            <span className="text-xl font-black tracking-tighter uppercase italic">EcoCycle</span>
                        </div>
                        <nav className="hidden lg:flex items-center gap-6">
                            <button onClick={() => navigate('/home')} className="text-sm font-bold text-slate-500 hover:text-[#4CAF50] cursor-pointer transition-colors">Home</button>
                            <button onClick={() => navigate('/log-waste')} className="text-sm font-bold text-slate-500 hover:text-[#4CAF50] cursor-pointer transition-colors">Log Waste</button>
                            <button onClick={() => navigate('/my-activity')} className="text-sm font-bold text-[#4CAF50] cursor-pointer">Pickup Request</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                                <Zap size={14} className="text-yellow-500 fill-yellow-500" /><span className="text-xs font-black text-yellow-700 tracking-tighter">{userStats.points} Coins</span>
                            </div>
                        )}
                        {user && (
                            <div className="hidden lg:block relative" ref={dropdownRef}>
                                <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl border bg-white border-slate-200 hover:border-slate-300 transition-all cursor-pointer active:scale-95">
                                    <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-xs">{user.name.charAt(0).toUpperCase()}</div>
                                    <div className="text-left leading-none"><p className="text-[11px] font-black text-slate-800 mb-1 uppercase">{user.name.split(' ')[0]}</p><p className="text-[9px] font-bold text-[#4CAF50] uppercase tracking-widest">Member</p></div>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
                                        <div className="px-4 py-3 border-b border-slate-50"><p className="text-xs font-black text-slate-900 truncate uppercase">{user.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified User</p></div>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"><LogOut size={16} /> Sign Out</button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button className="lg:hidden relative w-10 h-10 flex items-center justify-center text-slate-900 bg-slate-100 rounded-xl active:scale-90 transition-all cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <div className={`transition-transform duration-500 ${isMobileMenuOpen ? 'rotate-[360deg]' : 'rotate-0'}`}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</div>
                        </button>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT AREA: FIXED PADDING TOP FOR PC --- */}
            <main className="flex-grow w-full max-w-4xl mx-auto px-4 md:px-8 pt-24 pb-12">
                <div className="mb-8 space-y-6">
                    <div className="text-center md:text-left animate-in fade-in slide-in-from-left-4 duration-500">
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic leading-none">Activity Terminal</h1>
                        <p className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-widest">Tracking your environmental footprints</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Search Bar: Mobile friendly */}
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Filter materials..." className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#4CAF50] outline-none cursor-text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        {/* Status Tabs: Proportional scroll on mobile */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar w-full">
                            <FilterButton label="All" count={activities.length} />
                            <FilterButton label="Pending" count={activities.filter(a => a.status === 'Pending').length} />
                            <FilterButton label="Schedule" count={activities.filter(a => a.status === 'Accepted').length} />
                            <FilterButton label="Rejected" count={activities.filter(a => a.status === 'Rejected').length} />
                        </div>
                    </div>
                </div>

                {/* Logs List: Mobile optimized width */}
                <div className="space-y-4 w-full">
                    {filteredActivities.length > 0 ? filteredActivities.map((item, idx) => (
                        <div key={item._id} className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center gap-4 md:gap-5">
                                <div className="p-4 rounded-2xl bg-slate-50 text-slate-300 group-hover:text-[#4CAF50] transition-colors"><Package size={24} /></div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-lg md:text-xl text-slate-800 tracking-tight italic uppercase truncate">{item.material}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{item.weight} KG • {new Date(item.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                                <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border ${item.status === 'Accepted' ? 'bg-green-50 text-green-700 border-green-100' : item.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>{item.status}</span>
                                {item.status === 'Accepted' && (item.pickupDetails?.isRequested ? <div className="flex items-center gap-2 text-teal-600 bg-teal-50 px-4 py-2.5 rounded-xl border border-teal-100 font-black text-[9px] uppercase tracking-widest"><CheckCircle size={14} /> Requested</div> : <button onClick={() => handleOpenPickup(item._id)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black active:scale-95 flex items-center gap-2 cursor-pointer transition-all shadow-lg"><Truck size={16} /> Schedule</button>)}
                            </div>
                        </div>
                    )) : <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100"><Clock className="h-12 w-12 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-black uppercase text-xs tracking-widest italic leading-relaxed">No activity records found</p></div>}
                </div>
            </main>

            {showModal && <RequestPickup wasteId={selectedWasteId} onClose={() => { setShowModal(false); fetchActivity(); }} />}
            
            {/* MOBILE NAV DROPDOWN (SYNCED) */}
            <div className={`lg:hidden fixed top-16 left-0 right-0 z-[90] bg-white border-b border-slate-200 shadow-2xl transition-all duration-300 ease-in-out origin-top ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
                <div className="p-6 flex flex-col gap-4">
                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-2">
                            <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-xl">{user.name.charAt(0).toUpperCase()}</div>
                            <div><p className="text-sm font-black text-slate-900 uppercase tracking-tight">{user.name}</p><p className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest">Authorized Member</p></div>
                        </div>
                    )}
                    <button onClick={() => {navigate('/home'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase text-left py-3 border-b border-slate-50 cursor-pointer">Home</button>
                    <button onClick={() => {navigate('/log-waste'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase text-left py-3 border-b border-slate-50 cursor-pointer">Log Waste</button>
                    <button onClick={() => {navigate('/my-activity'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase text-left py-3 border-b border-slate-50 cursor-pointer">Pickup Request</button>
                    {user ? <button onClick={handleLogout} className="p-4 bg-rose-50 text-rose-500 rounded-2xl text-sm font-black uppercase mt-2 cursor-pointer transition-all active:scale-95 shadow-sm">Sign Out</button> : <button onClick={() => navigate('/login')} className="p-4 bg-[#4CAF50] text-white rounded-2xl text-sm font-black uppercase cursor-pointer shadow-md">Sign In</button>}
                </div>
            </div>

            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}