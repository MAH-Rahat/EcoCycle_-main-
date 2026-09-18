import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, BarChart3, MapPin, Globe, Activity, PieChart, 
    Leaf, LogOut, Menu, X 
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminAnalytics() {
    const navigate = useNavigate();
    const [data, setData] = useState({ areaStats: [], globalTotal: 0, totalRequests: 0 });
    const [loading, setLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE_URL}/api/analytics/waste-stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (error) {
                console.error("Analytics Error", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const handleNavigate = (path) => {
        if (window.location.pathname === path) return;
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#051F20] text-white font-bold tracking-widest text-center px-6">
            <div className="w-12 h-12 border-4 border-[#163832] border-t-[#22c55e] rounded-full animate-spin mb-4"></div>
            <p className="animate-pulse text-xs md:text-sm uppercase text-[#8EB69B]">Synchronizing Global Eco-Intelligence...</p>
        </div>
    );

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
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
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
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-10 pt-36 pb-24 space-y-8">
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    
                    {/* --- LEFT COLUMN: HIGH-LEVEL STATS --- */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Global Volume Card */}
                        <div className="bg-[#051F20] p-8 md:p-10 rounded-2xl text-white shadow-[0_10px_30px_rgba(5,31,32,0.15)] relative overflow-hidden group animate-slideUp opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                            <Globe className="absolute -right-4 -top-4 h-32 w-32 opacity-10 group-hover:rotate-12 transition-transform duration-700 text-[#22c55e]" />
                            <p className="text-[#8EB69B] font-bold uppercase text-xs tracking-wider mb-2">Total Waste Volume</p>
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                                {data.globalTotal} <span className="text-lg font-medium text-[#8EB69B]">KG</span>
                            </h2>
                            <div className="mt-6 flex items-center gap-2 text-[#22c55e] text-xs font-bold uppercase tracking-wider bg-white/5 w-fit px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md">
                                <Activity size={14} /> {data.totalRequests} Nodes Logged
                            </div>
                        </div>

                        {/* Ranking List */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                            <h3 className="font-bold text-[#051F20] mb-6 flex items-center gap-2 uppercase text-xs tracking-wider">
                                <MapPin size={16} className="text-[#22c55e]" /> Regional Hotspots
                            </h3>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                                {data.areaStats.length > 0 ? data.areaStats.map((area, i) => (
                                    <div key={i} className="flex justify-between items-center group cursor-default p-2 hover:bg-[#F4F9F5] rounded-xl transition-colors">
                                        <span className="font-medium text-[#235347] group-hover:text-[#051F20] transition-colors truncate max-w-[150px] text-sm">{area._id}</span>
                                        <span className="bg-[#F4F9F5] border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-[#051F20] tabular-nums">
                                            {area.totalWeight} KG
                                        </span>
                                    </div>
                                )) : <p className="text-[#8EB69B] text-xs font-medium">Awaiting regional signal...</p>}
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN: VISUAL DISTRIBUTION --- */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 h-full flex flex-col animate-slideUp opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 pb-6 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-[#051F20] flex items-center gap-2 tracking-tight">
                                    <PieChart className="text-[#22c55e] h-6 w-6" /> Geo-Analytics Matrix
                                </h3>
                                <div className="text-xs font-bold bg-[#22c55e]/10 text-[#22c55e] px-3.5 py-1.5 rounded-full uppercase tracking-wider border border-[#22c55e]/20">Live Distribution</div>
                            </div>

                            {/* --- RESPONSIVE CHART --- */}
                            <div className="flex-1 flex items-end justify-around gap-2 md:gap-4 px-2 md:px-4 border-b border-gray-100 pb-4 mb-8 min-h-[300px]">
                                {data.areaStats.map((area, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        {/* Tooltip */}
                                        <div className="absolute -top-12 bg-[#051F20] text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-2 font-bold z-10 shadow-lg pointer-events-none uppercase tracking-wider border border-white/10">
                                            {area.totalWeight} KG
                                        </div>
                                        {/* Bar */}
                                        <div 
                                            className="w-full max-w-[40px] md:max-w-[60px] bg-gradient-to-t from-[#051F20] via-[#163832] to-[#22c55e] rounded-t-xl transition-all duration-1000 ease-out hover:brightness-110 cursor-pointer shadow-sm"
                                            style={{ height: `${(area.totalWeight / (Math.max(...data.areaStats.map(a => a.totalWeight)) || 1)) * 90}%` }}
                                        ></div>
                                        {/* Label */}
                                        <span className="text-[10px] font-bold text-[#235347] mt-4 uppercase tracking-wider text-center h-4 truncate w-full">
                                            {area._id}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Insight Summary Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 bg-[#F4F9F5] rounded-xl border border-gray-100 text-center hover:border-[#22c55e]/40 transition-colors group cursor-default">
                                    <p className="text-xs font-bold text-[#8EB69B] uppercase mb-1 tracking-wider">Primary Contribution Zone</p>
                                    <p className="font-bold text-[#051F20] text-base group-hover:scale-105 transition-transform">{data.areaStats[0]?._id || "Scanning..."}</p>
                                </div>
                                <div className="p-6 bg-[#F4F9F5] rounded-xl border border-gray-100 text-center hover:border-[#22c55e]/40 transition-colors group cursor-default">
                                    <p className="text-xs font-bold text-[#8EB69B] uppercase mb-1 tracking-wider">Regional Density Average</p>
                                    <p className="font-bold text-[#22c55e] text-base group-hover:scale-105 transition-transform tabular-nums">
                                        {data.areaStats.length ? (data.globalTotal / data.areaStats.length).toFixed(1) : 0} <span className="text-xs uppercase text-[#051F20]">KG / Area</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {/* --- FOOTER --- */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Leaf size={18} className="text-[#22c55e]" />
                            <span>EcoCycle Analytics Terminal</span>
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
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .animate-fadeInUp { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-slideUp { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }

                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}