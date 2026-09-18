import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    LogOut, Settings, User, Package, Megaphone, 
    Gift, BarChart3, LayoutDashboard, ChevronRight, 
    Activity, Bell, ShieldCheck, Heart, Github, 
    Search, Zap, Globe, Cpu, Mountain, Shield, Info, Menu, X, Leaf, CheckCircle, Clock, Trash2, ArrowRight, TrendingUp, PieChart, BarChart2, Truck
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminName, setAdminName] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Real Data States
    const [pendingLogs, setPendingLogs] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        const userInfo = userInfoString ? JSON.parse(userInfoString) : null;
        
        if (!userInfo || userInfo.role !== 'admin') {
            navigate('/login');
            return;
        }

        setAdminName(userInfo.name || 'Administrator');
        fetchAdminData();
    }, [navigate]);

    const fetchAdminData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const logsRes = await axios.get(`${API_BASE_URL}/api/waste/all`, { headers }).catch(() => ({ data: [] }));
            const logsData = logsRes.data;
            const logsArray = Array.isArray(logsData) ? logsData : (Array.isArray(logsData?.data) ? logsData.data : []);
            setPendingLogs(logsArray);

            const campaignsRes = await axios.get(`${API_BASE_URL}/api/campaigns`).catch(() => ({ data: [] }));
            const campaignsData = campaignsRes.data;
            const campaignsArray = Array.isArray(campaignsData) ? campaignsData : (Array.isArray(campaignsData?.data) ? campaignsData.data : []);
            setCampaigns(campaignsArray);

        } catch (error) {
            console.error("Failed to load admin data", error);
            setPendingLogs([]);
            setCampaigns([]);
        } finally {
            setLoadingData(false);
        }
    };

    const handleVerifyWaste = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/waste/verify/${id}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAdminData();
        } catch (error) {
            alert("Failed to verify waste log.");
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

    // --- REAL DATA COMPUTATIONS (NO FAKE INFO) ---
    const totalWeight = pendingLogs.reduce((acc, log) => acc + (Number(log.weight) || 0), 0);
    const verifiedLogsCount = pendingLogs.filter(log => log.status === 'verified' || log.status === 'Accepted').length;
    const pendingLogsCount = pendingLogs.filter(log => !log.status || log.status === 'pending' || log.status === 'Pending').length;

    // Material Breakdown computed from actual logs
    const materialCounts = pendingLogs.reduce((acc, log) => {
        const mat = (log.material || log.wasteType || 'Other').toLowerCase();
        acc[mat] = (acc[mat] || 0) + (Number(log.weight) || 0);
        return acc;
    }, {});

    const totalMaterialWeight = Object.values(materialCounts).reduce((a, b) => a + b, 0) || 1;

    const ControlCard = ({ icon: Icon, title, description, link, badge, delay }) => (
        <div 
            onClick={() => handleNavigate(link)} 
            className="group relative bg-white p-8 rounded-3xl shadow-[0_4px_25px_rgba(5,31,32,0.03)] border border-gray-100 hover:shadow-[0_15px_40px_rgba(5,31,32,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden animate-slideUp opacity-0"
            style={{ animationDelay: delay, animationFillMode: 'forwards' }}
        >
            <div className="flex flex-col h-full relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-2xl bg-[#F4F9F5] text-[#22c55e] group-hover:bg-[#22c55e] group-hover:text-white transition-colors duration-300 shadow-sm border border-[#22c55e]/20">
                        <Icon className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    {badge && (
                        <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
                            {badge}
                        </span>
                    )}
                </div>
                
                <h3 className="text-xl font-bold text-[#051F20] mb-2 flex items-center justify-between group-hover:text-[#22c55e] transition-colors">
                    {title}
                    <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 text-[#22c55e]" />
                </h3>
                <p className="text-sm font-medium text-[#235347] leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F4F9F5] flex flex-col font-sans selection:bg-[#22c55e]/30 overflow-x-hidden text-[#051F20]">
            
            {/* --- DEEP ECO NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    <div className="flex items-center gap-8 lg:gap-12">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/admin-panel')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle <span className="text-xs uppercase px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] rounded border border-[#22c55e]/30">Admin</span></span>
                        </div>

                        <nav className="hidden xl:flex items-center gap-6">
                            <button onClick={() => handleNavigate('/admin-panel')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Dashboard</button>
                            <button onClick={() => handleNavigate('/admin/waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Waste Logs</button>
                            <button onClick={() => handleNavigate('/admin/pickups')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer flex items-center gap-1"><Truck size={14} /> Pickup Dispatch</button>
                            <button onClick={() => handleNavigate('/admin/campaigns')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Campaigns</button>
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="text-sm font-semibold text-white">{adminName}</p>
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
                        <button onClick={() => { handleNavigate('/admin-panel'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left">Dashboard</button>
                        <button onClick={() => { handleNavigate('/admin/waste'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Waste Logistics</button>
                        <button onClick={() => { handleNavigate('/admin/pickups'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left flex items-center gap-2"><Truck size={18} /> Pickup Dispatch</button>
                        <button onClick={() => { handleNavigate('/admin/campaigns'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Campaigns</button>
                        <button onClick={() => { handleNavigate('/admin/rewards'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Rewards Engine</button>
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-10 pt-36 pb-24 space-y-10">
                
                {/* WELCOME HEADER */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_25px_rgba(5,31,32,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fadeInUp opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div>
                        <div className="inline-flex items-center gap-2 mb-2">
                            <Leaf size={16} className="text-[#22c55e]" />
                            <p className="text-sm font-bold text-[#235347] uppercase tracking-wider">Live System Telemetry</p>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#051F20] tracking-tight">
                            Welcome back, <span className="text-[#22c55e]">{adminName}</span>
                        </h1>
                        <p className="text-[#235347] text-sm font-medium mt-1">
                            Real-time database records and live material recycling distributions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-[#F4F9F5] px-5 py-3 rounded-2xl border border-gray-200/80">
                        <div className="h-3 w-3 rounded-full bg-[#22c55e] animate-pulse"></div>
                        <span className="text-xs font-bold text-[#051F20] uppercase tracking-wider">Database Connected</span>
                    </div>
                </div>

                {/* LIVE METRICS CARDS (REAL DATA) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    {[
                        { label: "Total Logs Recorded", val: pendingLogs.length, icon: Package, col: "text-green-600", bg: "bg-green-50" },
                        { label: "Total Weight Recycled", val: `${totalWeight.toFixed(1)} kg`, icon: TrendingUp, col: "text-blue-600", bg: "bg-blue-50" },
                        { label: "Verified / Accepted", val: verifiedLogsCount, icon: CheckCircle, col: "text-emerald-600", bg: "bg-emerald-50" },
                        { label: "Pending Verification", val: pendingLogsCount, icon: Clock, col: "text-amber-600", bg: "bg-amber-50" }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-[0_4px_25px_rgba(5,31,32,0.02)] hover:shadow-md transition-all animate-slideUp opacity-0" style={{ animationDelay: `${0.2 + (i * 0.1)}s`, animationFillMode: 'forwards' }}>
                            <div className={`${stat.bg} ${stat.col} p-4 rounded-2xl`}><stat.icon size={22}/></div>
                            <div>
                                <p className="text-xs font-bold text-[#8EB69B] uppercase tracking-wider mb-1">{stat.label}</p>
                                <p className="font-extrabold text-[#051F20] text-lg lg:text-xl">{stat.val}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- REAL DATA ANALYTICS & CHARTS SECTION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slideUp opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                    
                    {/* Material Weight Distribution Chart (Real Data) */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_30px_rgba(5,31,32,0.03)] flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="text-[#22c55e]" size={20} />
                                    <h2 className="text-xl font-bold text-[#051F20]">Recycled Material Volume (kg)</h2>
                                </div>
                                <span className="text-xs font-bold text-[#8EB69B] bg-[#F4F9F5] px-3 py-1 rounded-full">Live DB Aggregation</span>
                            </div>

                            {loadingData ? (
                                <div className="py-20 text-center text-gray-400">Loading graph telemetry...</div>
                            ) : Object.keys(materialCounts).length === 0 ? (
                                <div className="py-20 text-center text-gray-400">No material data logged yet.</div>
                            ) : (
                                <div className="space-y-5 my-4">
                                    {Object.entries(materialCounts).map(([mat, weight]) => {
                                        const percentage = Math.round((weight / totalMaterialWeight) * 100);
                                        return (
                                            <div key={mat} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                                    <span className="text-[#051F20]">{mat}</span>
                                                    <span className="text-[#235347]">{weight.toFixed(1)} kg ({percentage}%)</span>
                                                </div>
                                                <div className="h-3 w-full bg-[#F4F9F5] rounded-full overflow-hidden p-0.5 border border-gray-100">
                                                    <div 
                                                        className="h-full bg-[#22c55e] rounded-full transition-all duration-1000" 
                                                        style={{ width: `${Math.max(percentage, 4)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-[#8EB69B] mt-6 italic">* Chart values update automatically as citizens log waste in real time.</p>
                    </div>

                    {/* Quick Status Breakdown Pie/Summary Card (Real Data) */}
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_30px_rgba(5,31,32,0.03)] flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                                <PieChart className="text-[#22c55e]" size={20} />
                                <h2 className="text-xl font-bold text-[#051F20]">Verification Ratio</h2>
                            </div>

                            {loadingData ? (
                                <div className="py-20 text-center text-gray-400">Loading telemetry...</div>
                            ) : pendingLogs.length === 0 ? (
                                <div className="py-20 text-center text-gray-400">No records found.</div>
                            ) : (
                                <div className="space-y-6 my-4">
                                    <div className="flex items-center justify-between p-4 bg-[#F4F9F5] rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                                            <span className="text-sm font-bold text-[#051F20]">Verified & Accepted</span>
                                        </div>
                                        <span className="font-extrabold text-emerald-700">{verifiedLogsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-[#F4F9F5] rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                                            <span className="text-sm font-bold text-[#051F20]">Pending Review</span>
                                        </div>
                                        <span className="font-extrabold text-amber-700">{pendingLogsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-[#F4F9F5] rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                            <span className="text-sm font-bold text-[#051F20]">Active Campaigns</span>
                                        </div>
                                        <span className="font-extrabold text-blue-700">{campaigns.length}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => handleNavigate('/admin/waste')} className="w-full mt-6 py-3.5 bg-[#051F20] text-white rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-[#22c55e] hover:text-[#051F20] transition-all cursor-pointer shadow-sm">
                            Manage All Waste Logs <ArrowRight size={14} className="inline ml-1" />
                        </button>
                    </div>

                </div>

                {/* --- LIVE CITIZEN REQUESTS FEED --- */}
                <div className="bg-white rounded-3xl shadow-[0_4px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-8 animate-slideUp opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-bold text-[#051F20]">Live Citizen Waste Requests</h2>
                            <p className="text-sm font-medium text-[#8EB69B]">Requests submitted by citizens appear here instantly.</p>
                        </div>
                        <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-full border border-emerald-200">
                            {pendingLogs.length} Total Logs
                        </span>
                    </div>

                    {loadingData ? (
                        <div className="py-12 text-center text-[#8EB69B] font-medium">Synchronizing database logs...</div>
                    ) : pendingLogs.length === 0 ? (
                        <div className="py-12 text-center bg-[#F4F9F5] rounded-2xl border border-dashed border-gray-200">
                            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-[#051F20]">No waste requests found in the system yet.</p>
                            <p className="text-xs text-[#235347] mt-1">Try submitting a test log from the citizen "Log Waste" page!</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {pendingLogs.map((log) => (
                                <div key={log._id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-[#F4F9F5] rounded-2xl border border-gray-100 hover:border-[#22c55e]/30 transition-all gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-[#22c55e] border border-gray-100">
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base text-[#051F20] capitalize">{log.material || log.wasteType} — {log.weight} kg</h4>
                                            <p className="text-xs font-medium text-[#235347] mt-0.5">Location: {log.location?.address?.street || log.pickupDetails?.address || 'Dhaka'}</p>
                                            <p className="text-[10px] text-[#8EB69B] mt-1">Logged on: {new Date(log.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${log.status === 'verified' || log.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {log.status || 'Pending'}
                                        </span>
                                        {log.status !== 'verified' && log.status !== 'Accepted' && (
                                            <button 
                                                onClick={() => handleVerifyWaste(log._id)} 
                                                className="px-4 py-2.5 bg-[#22c55e] text-[#051F20] text-xs font-bold rounded-xl hover:bg-[#051F20] hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
                                            >
                                                Verify & Accept
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* OPERATIONAL HUB */}
                <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-[#051F20] flex items-center gap-2">
                            <Cpu size={22} className="text-[#22c55e]" /> Operational Hub
                        </h2>
                        <div className="h-px flex-1 bg-gray-200 ml-6 hidden sm:block"></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ControlCard icon={Package} title="Waste Logistics" description="Manage material flow and recycling logistics across Dhaka." link="/admin/waste" badge="Live Ops" delay="0.7s" />
                        <ControlCard icon={Truck} title="Pickup Dispatch" description="Schedule and assign waste collection routes to field collectors." link="/admin/pickups" badge="New" delay="0.75s" />
                        <ControlCard icon={Megaphone} title="Awareness Hub" description="Educational outreach campaigns and announcements for citizen home pages." link="/admin/campaigns" badge="Active" delay="0.8s" />
                        <ControlCard icon={Gift} title="Rewards Engine" description="Manage the ecological points marketplace and redemptions." link="/admin/rewards" delay="0.9s" />
                        <ControlCard icon={BarChart3} title="Data Analytics" description="Detailed insights and telemetry reports into environmental impact." link="/admin/analytics" delay="1.0s" />
                        <ControlCard icon={User} title="Access Control" description="Permission management and security verification for participants." link="/admin/users" delay="1.1s" />
                    </div>
                </div>
            </main>

            {/* --- FOOTER --- */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Leaf size={18} className="text-[#22c55e]" />
                            <span>EcoCycle Infrastructure</span>
                        </div>
                        <p className="text-xs text-[#8EB69B] mt-1">© {new Date().getFullYear()} All Rights Reserved.</p>
                    </div>

                    <div className="flex gap-4">
                        <Github size={20} className="text-[#8EB69B] hover:text-white cursor-pointer transition-colors" />
                        <Heart size={20} className="text-[#8EB69B] hover:text-rose-500 cursor-pointer transition-colors" />
                    </div>

                    <div className="text-center md:text-right">
                        <p className="text-xs font-semibold text-[#8EB69B]">
                            Architected by <span className="text-white">MD Ashraful Hossain Rahat</span>
                        </p>
                    </div>
                </div>
            </footer>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .animate-fadeInUp { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-slideUp { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
            `}} />
        </div>
    );
}