import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Gift, User, Zap, Ticket, Coins, 
    ChevronRight, Award, Search, CheckCircle2, UserCheck, X, 
    Leaf, LogOut, Menu, AlertCircle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminRewards() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // --- REFS: Bypassing state-locking issues ---
    const shopRef = useRef();
    const amountRef = useRef();
    const costRef = useRef();
    const codeRef = useRef();

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/rewards/legacy/users-points`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = Array.isArray(res.data) ? res.data : (res.data.users || []);
            setUsers(userData);
            setFilteredUsers(userData);
        } catch (error) {
            console.error("Failed to fetch users", error);
            setErrorMsg("Could not fetch network citizens from database.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Handle Search
    useEffect(() => {
        const filtered = users.filter(u => 
            u.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    const handleIssueVoucher = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        
        if (!selectedUser) {
            setErrorMsg("Please select a target citizen node first.");
            return;
        }

        const payload = {
            shopName: shopRef.current.value,
            discountAmount: amountRef.current.value,
            pointsRequired: costRef.current.value,
            code: codeRef.current.value,
            userId: selectedUser._id
        };

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/api/rewards/legacy/issue-voucher`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccessMsg(response.data?.message || "Voucher successfully transmitted to citizen profile!");
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 4000);
            
            // Clear inputs via refs
            shopRef.current.value = "";
            amountRef.current.value = "";
            costRef.current.value = "";
            codeRef.current.value = "";
            
            setSelectedUser(null);
            fetchUsers(); 
        } catch (error) {
            setErrorMsg(error.response?.data?.message || "Failed to issue voucher");
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#051F20]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#163832] border-t-[#22c55e] rounded-full animate-spin"></div>
                <p className="text-[#8EB69B] font-bold tracking-widest uppercase text-xs">Accessing Reward Vault...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F4F9F5] font-sans text-[#051F20] flex flex-col overflow-x-hidden selection:bg-[#22c55e]/30">
            
            {/* SUCCESS NOTIFICATION POPUP BANNER */}
            {showSuccess && (
                <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] bg-[#051F20] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#22c55e]/30 animate-scaleIn">
                    <CheckCircle2 className="text-[#22c55e]" size={22} />
                    <span className="text-xs font-bold uppercase tracking-wider">{successMsg}</span>
                </div>
            )}

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
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
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
                        <button onClick={() => { handleNavigate('/admin/rewards'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left">Rewards Engine</button>
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            {/* --- MAIN HEADER CONTENT --- */}
            <div className="pt-36 pb-12 px-6 lg:px-10 max-w-5xl mx-auto w-full">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(5,31,32,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeInUp opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div>
                        <div className="inline-flex items-center gap-2 mb-2">
                            <Leaf size={16} className="text-[#22c55e]" />
                            <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Rewards Terminal</p>
                        </div>
                        <h1 className="text-3xl font-bold text-[#051F20] tracking-tight flex items-center gap-3">
                            <Award className="text-[#22c55e] h-8 w-8" />
                            Reward Hub
                        </h1>
                        <p className="text-sm font-medium text-[#235347] mt-1">Authorized Voucher Issuance Terminal</p>
                    </div>
                    <div className="bg-[#F4F9F5] p-5 rounded-2xl border border-gray-200 shadow-inner text-center shrink-0">
                        <p className="text-[10px] font-bold text-[#8EB69B] uppercase tracking-wider mb-1">Network Citizens</p>
                        <p className="text-3xl font-bold text-[#051F20]">{users.length}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 lg:px-10 w-full pb-24 space-y-8">
                
                {/* Error Banner if any */}
                {errorMsg && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
                        <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-700 font-bold">{errorMsg}</p>
                    </div>
                )}

                {/* --- STEP 1: Select User --- */}
                <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 overflow-hidden animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                    <div className="p-6 border-b border-gray-100 bg-[#F4F9F5]/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="font-bold text-[#051F20] flex items-center gap-3 uppercase text-xs tracking-wider">
                            <span className="bg-[#22c55e] text-[#051F20] w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold">01</span>
                            Select Targeted Citizen {selectedUser && <span className="text-[#22c55e] font-bold ml-2">(Selected: {selectedUser.name})</span>}
                        </h2>
                        <div className="relative w-full sm:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input 
                                type="text" 
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 outline-none transition-all cursor-text text-[#051F20]"
                            />
                        </div>
                    </div>
                    <div className="p-4 max-h-[350px] overflow-y-auto no-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                <div 
                                    key={u._id} 
                                    onClick={() => setSelectedUser(u)}
                                    className={`p-5 rounded-xl border transition-all cursor-pointer flex justify-between items-center group active:scale-[0.98] ${
                                        selectedUser?._id === u._id 
                                            ? 'border-[#22c55e] bg-[#22c55e]/10 shadow-sm' 
                                            : 'border-gray-100 hover:border-[#22c55e]/40 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl transition-colors ${selectedUser?._id === u._id ? 'bg-[#22c55e] text-[#051F20]' : 'bg-[#F4F9F5] text-[#8EB69B] group-hover:bg-[#22c55e]/20 group-hover:text-[#051F20]'}`}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Zap size={12} className="text-[#22c55e]" />
                                                <p className="text-xs text-[#235347] font-bold">{u.points} EcoPoints</p>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedUser?._id === u._id ? <UserCheck size={18} className="text-[#22c55e]" /> : <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />}
                                </div>
                            )) : (
                                <div className="col-span-full py-10 text-center">
                                    <p className="text-[#8EB69B] font-bold uppercase text-[10px] tracking-widest">No citizen matches found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- STEP 2: Voucher Form --- */}
                <div className={`bg-white rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border-t-8 border-[#22c55e] border-x border-b border-gray-100 transition-all duration-500 relative animate-slideUp opacity-0 ${!selectedUser ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'opacity-100'}`} style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                    {!selectedUser && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                            <p className="bg-[#051F20] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-2xl">
                                Unlock Step 1 to Configure Voucher
                            </p>
                        </div>
                    )}
                    
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-[#051F20] flex items-center gap-3 uppercase text-xs tracking-wider">
                            <span className="bg-[#22c55e] text-[#051F20] w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold">02</span>
                            Voucher Configuration
                        </h2>
                        {selectedUser && (
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-rose-500 cursor-pointer transition-colors">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleIssueVoucher} className="p-8 md:p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-[#235347] uppercase tracking-wider mb-2 ml-1">Merchant Identity</label>
                                    <input 
                                        ref={shopRef}
                                        required 
                                        type="text"
                                        className="w-full bg-[#F4F9F5] border border-gray-200 rounded-xl px-5 py-3.5 focus:border-[#22c55e] focus:bg-white outline-none transition-all font-bold text-sm text-[#051F20] cursor-text"
                                        placeholder="e.g. Amazon, local Supermarket"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#235347] uppercase tracking-wider mb-2 ml-1">Cryptic Auth Code</label>
                                    <input 
                                        ref={codeRef}
                                        required 
                                        type="text"
                                        className="w-full bg-[#F4F9F5] border border-gray-200 rounded-xl px-5 py-3.5 focus:border-[#22c55e] focus:bg-white outline-none transition-all font-mono font-bold text-[#22c55e] uppercase tracking-wider text-sm cursor-text"
                                        placeholder="SAVE-50-ABC"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[#235347] uppercase tracking-wider mb-2 ml-1">Discount Val</label>
                                        <input 
                                            ref={amountRef}
                                            required 
                                            type="number"
                                            className="w-full bg-[#F4F9F5] border border-gray-200 rounded-xl px-5 py-3.5 focus:border-[#22c55e] focus:bg-white outline-none transition-all font-bold text-sm text-[#051F20] cursor-text"
                                            placeholder="50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#235347] uppercase tracking-wider mb-2 ml-1">Cost (PTS)</label>
                                        <input 
                                            ref={costRef}
                                            required 
                                            type="number"
                                            className="w-full bg-[#F4F9F5] border border-gray-200 rounded-xl px-5 py-3.5 focus:border-[#22c55e] focus:bg-white outline-none transition-all font-bold text-sm text-[#051F20] cursor-text"
                                            placeholder="1000"
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        className="w-full bg-[#051F20] hover:bg-[#22c55e] text-white hover:text-[#051F20] font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer uppercase text-xs tracking-wider"
                                    >
                                        <Ticket size={18} />
                                        Authorize Distribution
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

            </div>

            {/* --- FOOTER --- */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Leaf size={18} className="text-[#22c55e]" />
                            <span>EcoCycle Reward Terminal</span>
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