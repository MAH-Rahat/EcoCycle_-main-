import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LogOut, Settings, User, Package, Megaphone, 
    Gift, BarChart3, LayoutDashboard, ChevronRight, 
    Activity, Bell, ShieldCheck, Heart, Github, 
    Search, Zap, Globe, Cpu, Mountain, Shield, Info, Link as LinkIcon
} from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminName, setAdminName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        const userInfo = userInfoString ? JSON.parse(userInfoString) : null;
        
        if (!userInfo || userInfo.role !== 'admin') {
            navigate('/login');
            return;
        }

        setAdminName(userInfo.name || 'Administrator');
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/login');
    };

    const ControlCard = ({ icon: Icon, title, description, color, link, badge }) => (
        <div 
            onClick={() => navigate(link)} 
            className="group relative bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-200 hover:shadow-2xl hover:border-teal-300 hover:bg-slate-50 transition-all duration-500 cursor-pointer overflow-hidden"
        >
            <div className="flex flex-col h-full relative z-10">
                <div className="flex justify-between items-start mb-5">
                    <div className={`p-4 rounded-2xl ${color} shadow-lg group-hover:scale-110 transition-all duration-300`}>
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    {badge && (
                        <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter border border-teal-100">
                            {badge}
                        </span>
                    )}
                </div>
                
                <h3 className="text-xl font-black text-slate-800 mb-2 flex items-center group-hover:text-teal-700 transition-colors tracking-tight">
                    {title}
                    <ChevronRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                    {description}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F1F5F9] flex overflow-hidden font-sans selection:bg-teal-100 selection:text-teal-900">
            {/* --- SIDEBAR --- */}
            <aside className="w-64 bg-[#0F172A] text-slate-400 flex flex-col shrink-0 border-r border-slate-800">
                <div className="p-8">
                    <div className="flex items-center gap-3 text-white mb-12 cursor-pointer" onClick={() => navigate('/admin-panel')}>
                        <div className="bg-teal-600 p-2.5 rounded-2xl shadow-lg shadow-teal-900/40">
                            <Mountain className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-black tracking-tighter uppercase italic">EcoCycle</span>
                    </div>

                    <nav className="space-y-2">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em] mb-4 ml-2">Control Node</p>
                        
                        <button className="w-full flex items-center gap-3 px-5 py-4 bg-teal-600 text-white rounded-2xl transition shadow-xl shadow-teal-950/20 active:scale-95 cursor-pointer">
                            <LayoutDashboard size={18} /> <span className="text-sm font-bold">Dashboard</span>
                        </button>

                        <button onClick={() => navigate('/admin/analytics')} 
                            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 hover:text-teal-400 rounded-2xl transition-all duration-300 group active:scale-95 cursor-pointer">
                            <BarChart3 size={18} /> 
                            <span className="text-sm font-bold">Intelligence</span>
                        </button>

                        <button onClick={() => navigate('/admin/users')} 
                            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 hover:text-teal-400 rounded-2xl transition-all duration-300 group active:scale-95 cursor-pointer">
                            <User size={18} /> 
                            <span className="text-sm font-bold">User Nodes</span>
                        </button>
                    </nav>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col overflow-y-auto relative">
                {/* HEADER: Added LOGOUT in upper section */}
                <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-slate-200 px-10 py-6 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-10">
                        <div>
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 text-teal-600">Administrative Portal</h2>
                            <p className="text-slate-900 font-black text-2xl tracking-tight">Welcome, <span className="text-slate-500 font-medium">{adminName}</span></p>
                        </div>
                        
                        <div className="hidden xl:flex items-center bg-slate-100 rounded-2xl px-5 py-2.5 border border-slate-200 w-80 group focus-within:ring-4 ring-teal-500/10 transition-all">
                            <Search size={18} className="text-slate-400 group-focus-within:text-teal-500" />
                            <input 
                                type="text" 
                                placeholder="Search ecosystem data..." 
                                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-600 w-full ml-2 placeholder:text-slate-400 outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* FEATURE ADDED: Logout button at top */}
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 bg-rose-50 text-rose-600 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95 cursor-pointer border border-rose-100"
                        >
                            <LogOut size={16} /> Logout
                        </button>

                        <button className="p-3 text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all rounded-2xl relative active:scale-90 border border-slate-100 cursor-pointer">
                            <Bell size={22} />
                            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                        </button>
                        
                        <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black shadow-sm active:scale-95 transition-transform cursor-pointer border-2 border-slate-800">
                            {adminName.charAt(0)}
                        </div>
                    </div>
                </header>

                <div className="p-10 max-w-7xl mx-auto flex-1 w-full space-y-12">
                    {/* STATS AREA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: "Stability", val: "Optimal", icon: Activity, col: "text-teal-600", bg: "bg-teal-50" },
                            { label: "Nodes", val: "1.2k Active", icon: Globe, col: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Efficiency", val: "94.2%", icon: Zap, col: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Encryption", val: "AES-256", icon: ShieldCheck, col: "text-slate-600", bg: "bg-slate-100" }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2.2rem] border border-slate-100 flex items-center gap-5 hover:shadow-lg transition-all duration-300 cursor-default group">
                                <div className={`${stat.bg} ${stat.col} p-4 rounded-2xl group-hover:scale-110 transition-transform`}><stat.icon size={24}/></div>
                                <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{stat.label}</p><p className="font-black text-slate-800 text-xl tracking-tighter">{stat.val}</p></div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-slate-800 mb-8 tracking-tight flex items-center gap-3 ml-2 italic">
                            <Cpu size={20} className="text-teal-500" /> Operational Hub
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <ControlCard icon={Package} title="Waste Logistics" description="Manage material flow and recycling logistics." color="bg-slate-800" link="/admin/waste" badge="Live Ops"/>
                            <ControlCard icon={Megaphone} title="Awareness Hub" description="Educational outreach for ecosystem preservation." color="bg-teal-600" link="/admin/campaigns"/>
                            <ControlCard icon={Gift} title="Rewards Engine" description="Manage the ecological points marketplace." color="bg-indigo-600" link="/admin/rewards"/>
                            <ControlCard icon={BarChart3} title="Data Analytics" description="Detailed insights into environmental impact." color="bg-blue-600" link="/admin/analytics"/>
                            <ControlCard icon={User} title="Access Control" description="Permission management for system participants." color="bg-slate-700" link="/admin/users"/>
                            <ControlCard icon={Settings} title="System Health" description="Core technical diagnostics and maintenance." color="bg-slate-500" link="/admin/diagnostics"/>
                        </div>
                    </div>
                </div>

                {/* --- FOOTER --- */}
                <footer className="w-full bg-white border-t border-slate-200 pt-12 pb-6 px-12 mt-auto">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 space-y-4">
                            <div className="flex items-center gap-2 text-teal-600 font-black tracking-tighter uppercase text-sm">
                                <ShieldCheck size={18} />
                                <span>EcoCycle Admin System</span>
                            </div>
                            <p className="text-slate-500 text-xs leading-relaxed font-medium italic">
                                Professional environmental resource management platform.
                            </p>
                        </div>

                        <div className="col-span-1 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <LinkIcon size={12}/> Resource Navigation
                            </h4>
                            <ul className="text-slate-500 text-xs space-y-2 font-semibold">
                                <li className="hover:text-teal-600 cursor-pointer transition-colors">Documentation</li>
                                <li className="hover:text-teal-600 cursor-pointer transition-colors">System Policy</li>
                            </ul>
                        </div>

                        <div className="col-span-1 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={12}/> System Metrics
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                Operational Stable
                            </div>
                        </div>

                        <div className="col-span-1 space-y-4">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Info size={12}/> Terminal Support
                            </h4>
                            <div className="flex gap-4">
                                <Github size={20} className="text-slate-300 hover:text-slate-900 cursor-pointer transition-all" />
                                <Heart size={20} className="text-slate-300 hover:text-rose-500 cursor-pointer transition-all" />
                            </div>
                        </div>
                    </div>
                    <div className="max-w-7xl mx-auto pt-6 border-t border-slate-100 flex justify-between items-center">
                        <p className="text-slate-300 text-[10px] font-bold tracking-widest uppercase italic">
                            © {new Date().getFullYear()} EcoCycle Infrastructure
                        </p>
                        <div className="opacity-20 hover:opacity-100 transition-opacity duration-500">
                            <p className="text-slate-400 text-[9px] font-black tracking-[0.2em] uppercase">
                                Architected by <span className="text-slate-600">MAHR</span>
                            </p>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}