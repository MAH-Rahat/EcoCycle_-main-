import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Package, Clock, CheckCircle, Leaf, Search, 
    Menu, X, LogOut, UserCircle, ArrowRight, 
    Truck, RefreshCw, Layers, ChevronRight, AlertCircle, Calendar, Recycle
} from 'lucide-react';
import RequestPickup from './RequestPickup'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MyActivity() {
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [pageLoading, setPageLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedWasteId, setSelectedWasteId] = useState(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userStats, setUserStats] = useState({ points: 0 });
    const [isExiting, setIsExiting] = useState(false);
    const dropdownRef = useRef(null);

    const userInfoString = localStorage.getItem('userInfo');
    const user = userInfoString ? JSON.parse(userInfoString) : null;

    const fetchActivity = async () => {
        if (!user || !user._id) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const res = await axios.get(`${API_BASE_URL}/api/waste/user/${user._id}`, { headers });
            setActivities(res.data);
            setFilteredActivities(res.data);
            
            const statsRes = await axios.get(`${API_BASE_URL}/api/waste/stats/${user._id}`, { headers });
            setUserStats(statsRes.data);
        } catch (error) { 
            console.error("Fetch failed:", error); 
        } finally { 
            setPageLoading(false); 
        }
    };

    const handleNavigate = (path) => {
        setIsExiting(true);
        setTimeout(() => navigate(path), 400);
    };

    const handleScrollToAbout = () => {
        setIsExiting(true);
        setTimeout(() => {
            navigate('/home');
            setTimeout(() => {
                const aboutSection = document.getElementById('about-section');
                if (aboutSection) {
                    aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 300);
        }, 400);
    };

    useEffect(() => {
        if (!user) { 
            navigate('/login'); 
        } else { 
            fetchActivity(); 
        }

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
        if (activeTab === 'Schedule') result = result.filter(item => item.status === 'verified' || item.status === 'Accepted');
        else if (activeTab !== 'All') result = result.filter(item => item.status === activeTab.toLowerCase() || item.status === activeTab);
        
        if (searchTerm) result = result.filter(item => (item.material || item.wasteType || '').toLowerCase().includes(searchTerm.toLowerCase()));
        setFilteredActivities(result);
    }, [activeTab, searchTerm, activities]);

    const handleLogout = () => {
        setIsExiting(true);
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            localStorage.removeItem('token');
            navigate('/');
            setIsMobileMenuOpen(false);
        }, 400);
    };

    const handleOpenPickup = (id) => {
        setSelectedWasteId(id);
        setShowModal(true);
    };

    if (pageLoading) {
        return (
            <div className="min-h-screen bg-[#F4F9F5] flex flex-col justify-between font-sans animate-pulse">
                <div className="h-24 bg-[#051F20]/80 border-b border-white/10 w-full"></div>
                <div className="max-w-7xl mx-auto w-full px-6 py-24 space-y-8">
                    <div className="h-20 bg-gray-200 rounded-2xl w-full"></div>
                    <div className="h-96 bg-gray-200 rounded-2xl w-full"></div>
                </div>
                <div className="h-24 bg-[#051F20] w-full"></div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-[#F4F9F5] font-sans flex flex-col text-[#051F20] transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            
            {/* --- PROFESSIONAL NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle</span>
                        </div>

                        <nav className="hidden lg:flex items-center gap-8">
                            <button onClick={() => handleNavigate('/home')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-colors cursor-pointer">Home</button>
                            <button onClick={() => handleNavigate('/log-waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-colors cursor-pointer">Log Waste</button>
                            <button onClick={() => handleNavigate('/my-activity')} className="text-sm font-semibold text-white transition-colors cursor-pointer">Pickup Request</button>
                            <button onClick={handleScrollToAbout} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-colors cursor-pointer">About</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        {user && (
                            <div className="hidden lg:block relative" ref={dropdownRef}>
                                <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-3 cursor-pointer group">
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-white group-hover:text-[#22c55e] transition-colors">{user.name.split(' ')[0]}</p>
                                        <p className="text-xs text-[#8EB69B]">{userStats.points} Impact Points</p>
                                    </div>
                                    <div className="h-10 w-10 bg-[#163832] border border-[#235347] rounded-full flex items-center justify-center text-[#22c55e] font-bold">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-4 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-50 animate-scaleIn origin-top-right">
                                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#163832] hover:bg-[#F4F9F5] rounded-lg transition-all cursor-pointer"><UserCircle size={18} /> Profile</button>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"><LogOut size={18} /> Sign Out</button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Smart Hamburger Button */}
                        <button className="lg:hidden text-white bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-[#22c55e] active:scale-90 transition-all duration-300 cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={24} className="text-[#22c55e]" /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* --- SMART TRANSLUCENT MOBILE MENU OVERLAY --- */}
                <div className={`lg:hidden fixed inset-0 z-[150] bg-[#051F20]/95 backdrop-blur-xl pt-24 px-6 flex flex-col justify-between pb-12 transition-all duration-500 ease-in-out ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
                    <div className="space-y-6 animate-fadeInUp">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <Leaf size={20} className="text-[#22c55e]" />
                                <span>EcoCycle Menu</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 bg-white/10 p-2 rounded-xl hover:text-white transition-colors cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        {user && (
                            <div className="flex items-center gap-4 p-4 bg-[#0B2B26] border border-white/10 rounded-2xl shadow-lg">
                                <div className="h-12 w-12 bg-[#22c55e] rounded-full flex items-center justify-center text-[#051F20] font-bold text-lg shadow-inner">{user.name.charAt(0).toUpperCase()}</div>
                                <div className="overflow-hidden">
                                    <p className="text-base font-bold text-white truncate">{user.name}</p>
                                    <p className="text-xs text-[#22c55e] font-medium">{userStats.points} Impact Points</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col space-y-2 pt-2">
                            <button onClick={() => { handleNavigate('/home'); setIsMobileMenuOpen(false); }} className="flex items-center justify-between p-4 rounded-xl text-white font-semibold text-base hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer group">
                                <span>Home</span>
                                <ArrowRight size={16} className="text-[#8EB69B] group-hover:translate-x-1 group-hover:text-[#22c55e] transition-all" />
                            </button>
                            <button onClick={() => { handleNavigate('/log-waste'); setIsMobileMenuOpen(false); }} className="flex items-center justify-between p-4 rounded-xl text-white font-semibold text-base hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer group">
                                <span>Log Waste</span>
                                <Recycle size={18} className="text-[#8EB69B] group-hover:text-[#22c55e]" />
                            </button>
                            <button onClick={() => { handleNavigate('/my-activity'); setIsMobileMenuOpen(false); }} className="flex items-center justify-between p-4 rounded-xl text-[#22c55e] bg-white/5 font-semibold text-base border border-white/10 transition-all cursor-pointer">
                                <span>Pickup Request</span>
                                <Truck size={18} className="text-[#22c55e]" />
                            </button>
                            <button onClick={() => { handleScrollToAbout(); setIsMobileMenuOpen(false); }} className="flex items-center justify-between p-4 rounded-xl text-white font-semibold text-base hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer group">
                                <span>About Us</span>
                                <ArrowRight size={16} className="text-[#8EB69B] group-hover:translate-x-1 group-hover:text-[#22c55e] transition-all" />
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                        {user ? (
                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold active:scale-95 transition-all cursor-pointer">
                                <LogOut size={18} /> Sign Out
                            </button>
                        ) : (
                            <button onClick={() => { handleNavigate('/login'); setIsMobileMenuOpen(false); }} className="w-full py-4 bg-[#22c55e] text-[#051F20] rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all cursor-pointer">
                                Log In
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-10 pt-36 pb-24 z-10 animate-fadeInUp">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(5,31,32,0.03)] mb-8">
                    <div>
                        <div className="inline-flex items-center gap-2 mb-1">
                            <Leaf size={16} className="text-[#22c55e]" />
                            <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Citizen Logistics</p>
                        </div>
                        <h2 className="text-3xl font-bold text-[#051F20] tracking-tight">Pickup Requests Matrix</h2>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#22c55e]" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search material..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full pl-12 pr-6 py-3 bg-[#F4F9F5] border border-gray-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-[#22c55e] transition-all text-[#051F20] placeholder:text-gray-400" 
                            />
                        </div>
                        <button onClick={fetchActivity} className="p-3 bg-[#F4F9F5] border border-gray-200 rounded-xl text-[#051F20] hover:bg-[#051F20] hover:text-white transition-all cursor-pointer shrink-0" title="Refresh Data">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 mb-6 overflow-x-auto pb-2">
                    <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm shrink-0">
                        {[
                            { label: 'All', count: activities.length },
                            { label: 'Pending', count: activities.filter(a => a.status === 'pending' || a.status === 'Pending').length },
                            { label: 'Schedule', count: activities.filter(a => a.status === 'verified' || a.status === 'Accepted').length },
                            { label: 'Rejected', count: activities.filter(a => a.status === 'rejected' || a.status === 'Rejected').length }
                        ].map((tab) => (
                            <button 
                                key={tab.label}
                                onClick={() => setActiveTab(tab.label)}
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    activeTab === tab.label 
                                        ? 'bg-[#051F20] text-white shadow-md' 
                                        : 'text-[#235347] hover:bg-[#F4F9F5]'
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 overflow-hidden animate-scaleIn">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-[#F4F9F5] border-b border-gray-100 text-[11px] font-bold text-[#235347] uppercase tracking-wider">
                                    <th className="py-4 px-6">Material Type</th>
                                    <th className="py-4 px-6">Estimated Weight</th>
                                    <th className="py-4 px-6">Pickup Address</th>
                                    <th className="py-4 px-6">Logged Timestamp</th>
                                    <th className="py-4 px-6">Current Status</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {filteredActivities.length > 0 ? filteredActivities.map((item) => {
                                    const isAccepted = item.status === 'verified' || item.status === 'Accepted';
                                    const isRejected = item.status === 'rejected' || item.status === 'Rejected';
                                    const isRequested = item.pickupDetails?.isRequested;
                                    const displayStatus = isAccepted ? (isRequested ? 'Scheduled' : 'Ready for Pickup') : isRejected ? 'Rejected' : 'Pending Verification';

                                    return (
                                        <tr key={item._id} className="hover:bg-[#F4F9F5]/40 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-[#F4F9F5] rounded-xl flex items-center justify-center text-[#22c55e] border border-gray-100 shadow-sm shrink-0">
                                                        <Package size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-[#051F20] capitalize">{item.material || item.wasteType}</p>
                                                        <p className="text-[11px] font-medium text-[#8EB69B]">ID: {item._id.slice(-6)}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <span className="font-bold text-[#051F20] text-base">{item.weight} kg</span>
                                            </td>

                                            <td className="py-4 px-6 max-w-[240px]">
                                                <span className="text-xs font-medium text-[#235347] truncate block">{item.pickupDetails?.address || 'Standard Location'}</span>
                                            </td>

                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <span className="text-xs font-medium text-[#8EB69B]">{new Date(item.createdAt).toLocaleDateString()}</span>
                                            </td>

                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                                                    isAccepted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {displayStatus}
                                                </span>
                                            </td>

                                            <td className="py-4 px-6 text-right whitespace-nowrap">
                                                {isAccepted ? (
                                                    isRequested ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200">
                                                            <CheckCircle size={14} /> Scheduled
                                                        </span>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleOpenPickup(item._id)} 
                                                            className="px-4 py-2 bg-[#22c55e] text-[#051F20] rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#051F20] hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                                                        >
                                                            <Truck size={14} /> Schedule
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-xs font-semibold text-gray-400">Awaiting Admin</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center">
                                            <Package className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                                            <h3 className="text-xl font-bold text-[#051F20] mb-1">No pickup logs found</h3>
                                            <p className="text-sm text-[#235347]">You haven't logged any waste under this criteria yet.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {showModal && <RequestPickup wasteId={selectedWasteId} onClose={() => { setShowModal(false); fetchActivity(); }} />}

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

            {/* --- CUSTOM ANIMATIONS STYLESHEET --- */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp { 
                    from { opacity: 0; transform: translateY(20px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
                @keyframes scaleIn { 
                    from { opacity: 0; transform: scale(0.97); } 
                    to { opacity: 1; transform: scale(1); } 
                }
                .animate-fadeInUp { animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}} />
        </div>
    );
}