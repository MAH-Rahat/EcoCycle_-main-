import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    LogOut, Zap, Package, Clock, Leaf, LogIn, X, User, ChevronDown, 
    Menu, ShieldCheck, BarChart3, Globe, Activity, ChevronRight, 
    Github, Mail, Settings, UserCircle, Bell, Search
} from 'lucide-react'; 

import heroPic1 from '../assets/hero-pic-1.jpg'; 
import heroPic2 from '../assets/hero-pic-2.jpg'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [campaigns, setCampaigns] = useState([]); 
    const [userStats, setUserStats] = useState({ points: 0, itemsLogged: 0 });
    const dropdownRef = useRef(null);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        if (userInfoString) {
            try {
                const loggedUser = JSON.parse(userInfoString);
                if (loggedUser?._id) {
                    setUser(loggedUser);
                    fetchUserStats(loggedUser._id);
                }
            } catch (e) { localStorage.removeItem('userInfo'); }
        }
        fetchCampaigns();

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchUserStats = async (userId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/stats/${userId}`);
            setUserStats(res.data);
        } catch (error) { setUserStats({ points: 0, itemsLogged: 0 }); }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/campaigns`);
            setCampaigns(res.data.filter(p => p.status === 'Active' || !p.status).slice(0, 6));
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleLogout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            setUser(null);
            navigate('/');
            setIsLoggingOut(false);
            setIsMobileMenuOpen(false);
        }, 800);
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-white">
            <div className="w-10 h-10 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen font-sans flex flex-col overflow-x-hidden bg-[#F8FAFC] text-slate-900">
            
            {/* --- MASTER NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex justify-between items-center">
                    
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
                            <div className="bg-[#4CAF50] p-1.5 rounded-lg shadow-md group-hover:rotate-12 transition-transform">
                                <Leaf className="text-white h-5 w-5" />
                            </div>
                            <span className="text-xl font-black tracking-tighter uppercase italic">EcoCycle</span>
                        </div>

                        {/* PC NAVIGATION: VISIBLE ONLY ON DESKTOP */}
                        <nav className="hidden lg:flex items-center gap-6">
                            <button onClick={() => navigate('/home')} className="text-sm font-bold text-[#4CAF50] hover:opacity-80 transition-opacity cursor-pointer">Home</button>
                            <button onClick={() => navigate('/log-waste')} className="text-sm font-bold text-slate-500 hover:text-[#4CAF50] transition-colors cursor-pointer">Log Waste</button>
                            <button onClick={() => user ? navigate('/my-activity') : navigate('/login')} className="text-sm font-bold text-slate-600 hover:text-[#4CAF50] transition-colors cursor-pointer">Pickup Request</button>
                            {isAdmin && <button onClick={() => navigate('/admin-panel')} className="text-[10px] font-black text-teal-600 border border-teal-200 px-3 py-1.5 rounded-xl uppercase tracking-widest cursor-pointer hover:bg-teal-50 transition-all">Admin Node</button>}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                                <Zap size={14} className="text-yellow-500 fill-yellow-500 animate-pulse" />
                                <span className="text-xs font-black text-yellow-700 uppercase tracking-tighter">{userStats.points} Coins</span>
                            </div>
                        )}

                        {/* ENHANCED PROFILE BUTTON (PC ONLY) */}
                        {user ? (
                            <div className="hidden lg:block relative" ref={dropdownRef}>
                                <button 
                                    onClick={() => setShowProfileDropdown(!showProfileDropdown)} 
                                    className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl border transition-all cursor-pointer active:scale-95 ${showProfileDropdown ? 'bg-slate-50 border-slate-300 shadow-inner' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'}`}
                                >
                                    <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-sm shadow-md overflow-hidden">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left leading-none">
                                        <p className="text-[11px] font-black text-slate-800 mb-1 uppercase tracking-tight">{user.name.split(' ')[0]}</p>
                                        <p className="text-[9px] font-bold text-[#4CAF50] uppercase tracking-widest">Member</p>
                                    </div>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                        <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                            <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                                        </div>
                                        <div className="p-1 space-y-1">
                                            <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"><UserCircle size={16} /> My Profile</button>
                                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"><LogOut size={16} /> Sign Out</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => navigate('/login')} className="hidden lg:block bg-[#4CAF50] text-white px-6 py-2.5 rounded-xl text-xs font-bold active:scale-95 cursor-pointer uppercase tracking-widest shadow-lg">Sign In</button>
                        )}
                        
                        {/* ROLLING HAMBURGER (MOBILE ONLY) */}
                        <button 
                            className="lg:hidden relative w-10 h-10 flex items-center justify-center text-slate-900 bg-slate-100 rounded-xl active:scale-90 transition-all cursor-pointer" 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            <div className={`transition-transform duration-500 ${isMobileMenuOpen ? 'rotate-[360deg]' : 'rotate-0'}`}>
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </div>
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-28 pb-12 px-4 lg:px-8 max-w-7xl mx-auto w-full flex-grow relative">
                {/* HERO */}
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-10 items-center mb-16">
                    <div className="lg:col-span-7 space-y-6 text-center lg:text-left order-2 lg:order-1">
                        <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-none uppercase italic">
                            {user ? 'Welcome back, ' : 'Recycle for '} <br />
                            <span className="text-[#4CAF50] not-italic">{user ? user.name.split(' ')[0] : 'The Future.'}</span>
                        </h1>
                        <p className="text-slate-500 text-lg font-medium max-w-xl mx-auto lg:mx-0">Join our movement. Log your waste, earn rewards, and build a sustainable legacy.</p>
                        <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4">
                            <button onClick={() => navigate('/log-waste')} className="bg-[#4CAF50] text-white px-10 py-4 rounded-2xl font-bold shadow-xl active:scale-95 flex items-center justify-center gap-3 cursor-pointer text-xs uppercase tracking-widest hover:bg-black transition-all">Log Waste</button>
                            <button onClick={() => user ? navigate('/my-activity') : navigate('/login')} className="bg-white text-slate-800 border-2 border-slate-200 px-10 py-4 rounded-2xl font-bold hover:bg-black hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer text-xs uppercase tracking-widest">Schedule Pickup</button>
                        </div>
                    </div>
                    <div className="lg:col-span-5 w-full order-1 lg:order-2">
                        <div className="relative group max-w-sm mx-auto lg:max-w-none">
                            <img src={heroPic1} className="w-full h-[300px] md:h-[450px] rounded-[2.5rem] md:rounded-[3rem] object-cover border-4 md:border-8 border-white shadow-2xl transition-transform group-hover:scale-[1.02]" alt="Hero" />
                            <div className="absolute -bottom-4 -left-4 md:-bottom-6 md:-left-6 w-32 h-32 md:w-48 md:h-48 rounded-[1.5rem] md:rounded-[2rem] border-4 md:border-8 border-white shadow-2xl overflow-hidden">
                                <img src={heroPic2} className="w-full h-full object-cover" alt="HeroSmall" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-16">
                    {[
                        { icon: Package, title: 'Logged', val: userStats.itemsLogged, col: 'bg-blue-500' },
                        { icon: Zap, title: 'Points', val: userStats.points, col: 'bg-amber-500' },
                        { icon: Globe, title: 'Rank', val: '#1', col: 'bg-teal-500' },
                        { icon: Activity, title: 'Goal', val: 'Silver', col: 'bg-purple-600' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center text-center md:text-left gap-3 md:gap-5 transition-all">
                            <div className={`p-2.5 rounded-xl ${s.col} bg-opacity-10 text-${s.col.split('-')[1]}-600`}><s.icon size={20}/></div>
                            <div>
                                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{s.title}</p>
                                <h3 className="text-sm md:text-xl font-black text-slate-900 leading-none">{s.val}</h3>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-20">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest italic mb-8">Community Feed</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {campaigns.map((post) => (
                            <div key={post._id} className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 hover:shadow-xl transition-all cursor-pointer flex flex-col h-full group">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="bg-green-50 text-[#4CAF50] text-[9px] font-bold px-3 py-1 rounded-full uppercase border border-green-100">{post.category}</span>
                                    <span className="text-[10px] font-bold text-slate-300">{new Date(post.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#4CAF50] transition-colors uppercase leading-tight mb-4">{post.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6 italic">"{post.content}"</p>
                                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 cursor-default"><ShieldCheck size={12} className="text-[#4CAF50]"/> EcoCycle Verified</span>
                                    <ChevronRight size={18} className="text-[#4CAF50] group-hover:translate-x-2 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* MOBILE DROPDOWN DROPDOWN */}
            <div className={`lg:hidden fixed top-16 left-0 right-0 z-[90] bg-white border-b border-slate-200 shadow-2xl transition-all duration-300 ease-in-out origin-top ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
                <div className="p-6 flex flex-col gap-4">
                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-2">
                            <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-xl">{user.name.charAt(0).toUpperCase()}</div>
                            <div>
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{user.name}</p>
                                <p className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest leading-none">Verified Member</p>
                            </div>
                        </div>
                    )}
                    <button onClick={() => {navigate('/home'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Home</button>
                    <button onClick={() => {navigate('/log-waste'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Log Waste</button>
                    <button onClick={() => {navigate('/my-activity'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Pickup Request</button>
                    <div className="flex flex-col gap-3 pt-2">
                        {user ? (
                            <button onClick={handleLogout} className="flex items-center justify-center gap-2 p-4 bg-rose-50 text-rose-500 rounded-2xl text-sm font-black uppercase cursor-pointer">Sign Out</button>
                        ) : (
                            <button onClick={() => navigate('/login')} className="p-4 bg-[#4CAF50] text-white rounded-2xl text-sm font-black uppercase tracking-widest cursor-pointer">Sign In</button>
                        )}
                    </div>
                </div>
            </div>

            <footer className="bg-white border-t border-slate-200 text-slate-500 py-12 px-6 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-slate-900 font-black text-xl italic cursor-pointer" onClick={() => navigate('/')}>
                        <Leaf className="text-[#4CAF50] h-6 w-6" /> EcoCycle
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">© 2026 Powered by MAHR</p>
                </div>
            </footer>
        </div>
    );
}