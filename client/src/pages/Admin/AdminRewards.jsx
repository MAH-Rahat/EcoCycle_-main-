import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Gift, User, Zap, Ticket, Coins, 
    ChevronRight, Award, Search, CheckCircle2, UserCheck, X
} from 'lucide-react';

// --- DUAL MODE URL CONFIG ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminRewards() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // --- REFS: Bypassing state-locking issues ---
    const shopRef = useRef();
    const amountRef = useRef();
    const costRef = useRef();
    const codeRef = useRef();

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/rewards/users-points`);
            setUsers(res.data);
            setFilteredUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users");
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
        
        const payload = {
            shopName: shopRef.current.value,
            discountAmount: amountRef.current.value,
            pointsRequired: costRef.current.value,
            code: codeRef.current.value,
            userId: selectedUser._id
        };

        try {
            await axios.post(`${API_BASE_URL}/api/rewards/issue-voucher`, payload);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            
            // Clear inputs via refs
            shopRef.current.value = "";
            amountRef.current.value = "";
            costRef.current.value = "";
            codeRef.current.value = "";
            
            setSelectedUser(null);
            fetchUsers(); 
        } catch (error) {
            alert(error.response?.data?.message || "Failed to issue voucher");
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-purple-400 font-black tracking-widest uppercase text-xs">Accessing Reward Vault...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 overflow-x-hidden">
            {/* --- Modern Dark Header --- */}
            <div className="bg-slate-900 text-white pb-24 pt-10 px-4 md:px-6">
                <div className="max-w-5xl mx-auto">
                    <button 
                        onClick={() => navigate('/admin-panel')} 
                        className="flex items-center text-slate-400 hover:text-white transition mb-8 group cursor-pointer font-black text-[10px] uppercase tracking-widest"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
                        Back to Control Center
                    </button>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center gap-3 italic uppercase">
                                <Award className="text-purple-400 h-8 w-8 md:h-12 md:w-12" />
                                Reward <span className="text-purple-400">Hub</span>
                            </h1>
                            <p className="text-slate-400 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">Authorized Voucher Issuance Terminal</p>
                        </div>
                        <div className="bg-slate-800 p-4 md:p-6 rounded-[2rem] border border-slate-700 shadow-2xl">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Network Citizens</p>
                            <p className="text-3xl font-black text-purple-400 italic tabular-nums">{users.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-6 -mt-12">
                <div className="grid grid-cols-1 gap-8">
                    
                    {/* --- STEP 1: Select User --- */}
                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="font-black text-slate-800 flex items-center gap-3 uppercase text-xs tracking-widest">
                                <span className="bg-purple-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px]">01</span>
                                Select Targeted Citizen
                            </h2>
                            <div className="relative w-full sm:w-64 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <input 
                                    type="text" 
                                    placeholder="Search by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-text"
                                />
                            </div>
                        </div>
                        <div className="p-4 max-h-[350px] overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                    <div 
                                        key={u._id} 
                                        onClick={() => setSelectedUser(u)}
                                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group active:scale-[0.98] ${
                                            selectedUser?._id === u._id 
                                            ? 'border-purple-600 bg-purple-50 shadow-lg shadow-purple-100' 
                                            : 'border-slate-50 hover:border-purple-200 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl transition-colors ${selectedUser?._id === u._id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600'}`}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm italic">{u.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Zap size={10} className="text-amber-500" />
                                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{u.points} EcoPoints</p>
                                                </div>
                                            </div>
                                        </div>
                                        {selectedUser?._id === u._id ? <UserCheck size={18} className="text-purple-600" /> : <ChevronRight size={18} className="text-slate-200 group-hover:translate-x-1 transition-transform" />}
                                    </div>
                                )) : (
                                    <div className="col-span-full py-10 text-center">
                                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No citizen matches found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- STEP 2: Voucher Form --- */}
                    <div className={`bg-white rounded-[2.5rem] shadow-2xl border-t-8 border-purple-600 transition-all duration-500 relative ${!selectedUser ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'opacity-100'}`}>
                        {!selectedUser && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                                <p className="bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                                    Unlock Step 1 to Configure Voucher
                                </p>
                            </div>
                        )}
                        
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-800 flex items-center gap-3 uppercase text-xs tracking-widest">
                                <span className="bg-purple-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px]">02</span>
                                Voucher Configuration
                            </h2>
                            {selectedUser && (
                                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer transition-colors">
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                        
                        <form onSubmit={handleIssueVoucher} className="p-6 md:p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Merchant Identity</label>
                                        <input 
                                            ref={shopRef}
                                            required 
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold text-sm cursor-text"
                                            placeholder="e.g. Amazon, local Supermarket"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Cryptic Auth Code</label>
                                        <input 
                                            ref={codeRef}
                                            required 
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-mono font-black text-purple-600 uppercase tracking-tighter text-sm cursor-text"
                                            placeholder="SAVE-50-ABC"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Discount Val</label>
                                            <input 
                                                ref={amountRef}
                                                required 
                                                type="number"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-black text-sm cursor-text"
                                                placeholder="50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Cost (PTS)</label>
                                            <input 
                                                ref={costRef}
                                                required 
                                                type="number"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-black text-sm cursor-text"
                                                placeholder="1000"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2">
                                        <button 
                                            type="submit" 
                                            className="w-full bg-slate-900 hover:bg-purple-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer uppercase text-xs tracking-widest"
                                        >
                                            <Ticket size={20} />
                                            Authorize Distribution
                                        </button>
                                        
                                        {showSuccess && (
                                            <div className="flex items-center justify-center gap-2 text-green-600 font-black text-[10px] uppercase animate-bounce mt-4">
                                                <CheckCircle2 size={16} /> Voucher Successfully Transmitted
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                </div>
            </div>

            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
}