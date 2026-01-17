import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LogOut, Settings, User, Package, Megaphone, 
    Gift, BarChart3, LayoutDashboard, ChevronRight, 
    Activity, Bell, ShieldCheck, Heart, Github, 
    Search, Zap, Globe, Cpu, Mountain, Shield, Info, Link as LinkIcon, Menu, X
} from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminName, setAdminName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            className="group relative bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-teal-300 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            <div className="flex flex-col h-full relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${color} shadow-lg group-hover:scale-110 transition-all`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                    {badge && (
                        <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase border border-teal-100">
                            {badge}
                        </span>
                    )}
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center group-hover:text-teal-600 transition-colors">
                    {title}
                    <ChevronRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </div>
    );

    const SidebarContent = () => (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center gap-3 text-white mb-10 cursor-pointer" onClick={() => navigate('/admin-panel')}>
                <div className="bg-teal-600 p-2 rounded-xl shadow-lg">
                    <Mountain className="h-5 w-5" />
                </div>
                <span className="text-lg font-black tracking-tighter uppercase italic">EcoCycle</span>
            </div>

            <nav className="space-y-1 flex-grow">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Main Menu</p>
                
                <button onClick={() => navigate('/admin-panel')} className="w-full flex items-center gap-3 px-4 py-3 bg-teal-600 text-white rounded-xl transition shadow-lg cursor-pointer">
                    <LayoutDashboard size={18} /> <span className="text-sm font-bold">Dashboard</span>
                </button>

                <button onClick={() => { navigate('/admin/analytics'); setIsMobileMenuOpen(false); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-teal-400 rounded-xl transition-all cursor-pointer">
                    <BarChart3 size={18} /> 
                    <span className="text-sm font-bold">Intelligence</span>
                </button>

                <button onClick={() => { navigate('/admin/users'); setIsMobileMenuOpen(false); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-teal-400 rounded-xl transition-all cursor-pointer">
                    <User size={18} /> 
                    <span className="text-sm font-bold">User Nodes</span>
                </button>
            </nav>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-teal-100 overflow-hidden">
            
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:flex w-64 bg-[#0F172A] text-slate-400 flex flex-col shrink-0 border-r border-slate-800">
                <SidebarContent />
            </aside>

            {/* --- MOBILE SIDEBAR OVERLAY --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-64 bg-[#0F172A] shadow-2xl animate-in slide-in-from-left duration-300">
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
                
                {/* --- STANDARD TOP HEADER --- */}
                <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                        
                        <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-4 py-2 border border-slate-200 w-64 group focus-within:ring-2 ring-teal-500/20 transition-all">
                            <Search size={16} className="text-slate-400 group-focus-within:text-teal-500" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-600 w-full ml-2 outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">
                        <div className="flex flex-col items-end mr-2 hidden sm:flex">
                            <p className="text-[11px] font-black text-slate-900 leading-none mb-1 uppercase">{adminName}</p>
                            <p className="text-[9px] font-bold text-teal-600 uppercase tracking-widest">System Admin</p>
                        </div>

                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
                            <button className="p-2 text-slate-400 hover:text-teal-600 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer relative">
                                <Bell size={18} />
                                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white"></span>
                            </button>
                            <button className="p-2 text-slate-400 hover:text-teal-600 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer">
                                <Settings size={18} />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button 
                                onClick={handleLogout}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Logout"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6 lg:space-y-8">
                    
                    {/* --- NEW ADMINISTRATIVE WELCOME SECTION --- */}
                    <div className="mb-2">
                        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                            System Overview: <span className="text-teal-600">{adminName}</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest opacity-80">
                            Ecosystem Management Interface • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* STATS AREA */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
                        {[
                            { label: "Stability", val: "Optimal", icon: Activity, col: "text-teal-600", bg: "bg-teal-50" },
                            { label: "Nodes", val: "1.2k Active", icon: Globe, col: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Efficiency", val: "94.2%", icon: Zap, col: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Encryption", val: "AES-256", icon: ShieldCheck, col: "text-slate-600", bg: "bg-slate-100" }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-4 lg:p-5 rounded-3xl border border-slate-100 flex flex-col sm:flex-row items-center gap-3 lg:gap-4 shadow-sm hover:shadow-md transition-all">
                                <div className={`${stat.bg} ${stat.col} p-3 rounded-2xl`}><stat.icon size={18}/></div>
                                <div className="text-center sm:text-left">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{stat.label}</p>
                                    <p className="font-black text-slate-800 text-sm lg:text-lg tracking-tight">{stat.val}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 italic">
                                <Cpu size={20} className="text-teal-500" /> Operational Hub
                            </h2>
                            <div className="h-px flex-1 bg-slate-200 ml-4 hidden sm:block"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
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
                <footer className="w-full bg-white border-t border-slate-200 py-8 px-6 lg:px-8 mt-auto">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center md:items-start">
                            <div className="flex items-center gap-2 text-teal-600 font-black tracking-tighter uppercase text-xs">
                                <ShieldCheck size={16} />
                                <span>EcoCycle Infrastructure</span>
                            </div>
                            <p className="text-slate-400 text-[10px] mt-1 font-medium">© {new Date().getFullYear()} All Rights Reserved.</p>
                        </div>

                        <div className="flex gap-6">
                            <Github size={18} className="text-slate-300 hover:text-slate-900 cursor-pointer transition-all" />
                            <Heart size={18} className="text-slate-300 hover:text-rose-500 cursor-pointer transition-all" />
                        </div>

                        <div className="text-center md:text-right">
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