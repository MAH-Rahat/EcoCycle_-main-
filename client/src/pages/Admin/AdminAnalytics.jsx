import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, BarChart3, MapPin, Globe, Activity, PieChart } from 'lucide-react';

// --- DUAL MODE URL CONFIG ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminAnalytics() {
    const navigate = useNavigate();
    const [data, setData] = useState({ areaStats: [], globalTotal: 0, totalRequests: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Using the Dynamic API URL for Local/Live switching
                const res = await axios.get(`${API_BASE_URL}/api/analytics/waste-stats`);
                setData(res.data);
            } catch (error) {
                console.error("Analytics Error", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-black tracking-widest text-center px-6">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="animate-pulse text-xs md:text-base uppercase">Synchronizing Global Eco-Intelligence...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <button 
                    onClick={() => navigate('/admin-panel')} 
                    className="flex items-center text-slate-500 hover:text-black mb-6 md:mb-8 font-black transition group cursor-pointer uppercase text-[10px] tracking-widest active:scale-95"
                >
                    <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform h-4 w-4" /> Back to Dashboard
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    
                    {/* --- LEFT COLUMN: HIGH-LEVEL STATS --- */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Global Volume Card */}
                        <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
                            <Globe className="absolute -right-4 -top-4 h-32 w-32 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                            <p className="text-blue-200 font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] mb-3">Total Waste Volume</p>
                            <h2 className="text-5xl md:text-6xl font-black tracking-tighter italic">
                                {data.globalTotal} <span className="text-xl font-medium opacity-50">KG</span>
                            </h2>
                            <div className="mt-8 flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest bg-white/10 w-fit px-4 py-2 rounded-2xl backdrop-blur-md">
                                <Activity size={14} className="text-blue-400" /> {data.totalRequests} Nodes Logged
                            </div>
                        </div>

                        {/* Ranking List */}
                        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
                                <MapPin size={16} className="text-rose-500" /> Regional Hotspots
                            </h3>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                                {data.areaStats.length > 0 ? data.areaStats.map((area, i) => (
                                    <div key={i} className="flex justify-between items-center group cursor-default">
                                        <span className="font-bold text-slate-600 group-hover:text-blue-600 transition-colors truncate max-w-[150px] text-sm italic">{area._id}</span>
                                        <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-800 tabular-nums">
                                            {area.totalWeight} KG
                                        </span>
                                    </div>
                                )) : <p className="text-slate-400 text-xs italic">Awaiting regional signal...</p>}
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN: VISUAL DISTRIBUTION --- */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-xl border border-slate-100 h-full flex flex-col">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tighter italic uppercase">
                                    <PieChart className="text-blue-600 h-7 w-7" /> Geo-Analytics
                                </h3>
                                <div className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-lg uppercase tracking-widest">Live Distribution Matrix</div>
                            </div>

                            {/* --- RESPONSIVE CHART --- */}
                            <div className="flex-1 flex items-end justify-around gap-2 md:gap-4 px-2 md:px-4 border-b-2 border-slate-50 pb-4 mb-8 min-h-[300px]">
                                {data.areaStats.map((area, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        {/* Tooltip */}
                                        <div className="absolute -top-10 bg-slate-900 text-white text-[9px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-2 font-black z-10 shadow-2xl pointer-events-none uppercase tracking-tighter">
                                            {area.totalWeight} KG
                                        </div>
                                        {/* Bar */}
                                        <div 
                                            className="w-full max-w-[40px] md:max-w-[60px] bg-gradient-to-t from-blue-800 via-blue-600 to-indigo-400 rounded-t-2xl transition-all duration-1000 ease-out hover:brightness-125 cursor-pointer shadow-lg shadow-blue-100/50 hover:shadow-blue-300"
                                            style={{ height: `${(area.totalWeight / (Math.max(...data.areaStats.map(a => a.totalWeight)) || 1)) * 90}%` }}
                                        ></div>
                                        {/* Label */}
                                        <span className="text-[8px] md:text-[9px] font-black text-slate-400 mt-4 uppercase tracking-tighter text-center h-4 truncate w-full italic">
                                            {area._id}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Insight Summary Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center hover:bg-blue-50/50 transition-colors group cursor-default">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Primary Contribution Zone</p>
                                    <p className="font-black text-blue-700 truncate text-lg italic group-hover:scale-105 transition-transform">{data.areaStats[0]?._id || "Scanning..."}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center hover:bg-indigo-50/50 transition-colors group cursor-default">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Regional Density Average</p>
                                    <p className="font-black text-indigo-700 text-lg group-hover:scale-105 transition-transform italic tabular-nums">
                                        {data.areaStats.length ? (data.globalTotal / data.areaStats.length).toFixed(1) : 0} <span className="text-xs uppercase opacity-60">KG / Area</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}