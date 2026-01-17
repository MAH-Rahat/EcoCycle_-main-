import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, BarChart3, MapPin, Globe, Activity, PieChart } from 'lucide-react';

export default function AdminAnalytics() {
    const navigate = useNavigate();
    const [data, setData] = useState({ areaStats: [], globalTotal: 0, totalRequests: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/analytics/waste-stats');
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
        <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-black animate-pulse tracking-widest">
            SYNCHRONIZING ECO-DATA...
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <button 
                    onClick={() => navigate('/admin-panel')} 
                    className="flex items-center text-slate-500 hover:text-black mb-8 font-bold transition group"
                >
                    <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* --- STAT CARDS --- */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[40px] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                            <Globe className="absolute -right-4 -top-4 h-32 w-32 opacity-10" />
                            <p className="text-blue-100 font-bold uppercase text-[10px] tracking-widest mb-2">Total Waste Volume</p>
                            <h2 className="text-5xl font-black">{data.globalTotal} <span className="text-xl font-medium">KG</span></h2>
                            <div className="mt-6 flex items-center gap-2 text-blue-100 text-sm font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                                <Activity size={14} /> {data.totalRequests} Requests Logged
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                <MapPin size={16} className="text-rose-500" /> Active Area Rankings
                            </h3>
                            <div className="space-y-4">
                                {data.areaStats.length > 0 ? data.areaStats.map((area, i) => (
                                    <div key={i} className="flex justify-between items-center group">
                                        <span className="font-bold text-slate-600 group-hover:text-blue-600 transition-colors truncate max-w-[150px]">{area._id}</span>
                                        <span className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl text-[10px] font-black text-slate-800">
                                            {area.totalWeight} KG
                                        </span>
                                    </div>
                                )) : <p className="text-slate-400 text-xs">No data available.</p>}
                            </div>
                        </div>
                    </div>

                    {/* --- GRAPHS --- */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-12">
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    <PieChart className="text-blue-600" /> Geographical Distribution
                                </h3>
                            </div>

                            {/* --- CHART --- */}
                            <div className="flex-1 flex items-end justify-around gap-2 px-4 border-b-2 border-slate-50 pb-2 mb-8 min-h-[250px]">
                                {data.areaStats.map((area, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div className="absolute -top-10 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 font-bold z-10 shadow-xl">
                                            {area.totalWeight} KG
                                        </div>
                                        <div 
                                            className="w-full max-w-[50px] bg-gradient-to-t from-blue-700 to-blue-400 rounded-t-xl transition-all duration-700 ease-out hover:brightness-110 cursor-pointer shadow-lg shadow-blue-100"
                                            style={{ height: `${(area.totalWeight / (data.globalTotal || 1)) * 100}%` }}
                                        ></div>
                                        <span className="text-[9px] font-black text-slate-400 mt-4 uppercase tracking-tighter text-center h-4 truncate w-full">
                                            {area._id}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Most Active Zone</p>
                                    <p className="font-black text-blue-600 truncate">{data.areaStats[0]?._id || "N/A"}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg per Zone</p>
                                    <p className="font-black text-indigo-600">
                                        {data.areaStats.length ? (data.globalTotal / data.areaStats.length).toFixed(1) : 0} <span className="text-xs">KG</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}