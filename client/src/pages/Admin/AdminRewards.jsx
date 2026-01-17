import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Gift, User, Zap, Ticket, Coins, ChevronRight, Award } from 'lucide-react';

export default function AdminRewards() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);

    // --- REFS: This bypasses state-locking issues entirely ---
    const shopRef = useRef();
    const amountRef = useRef();
    const costRef = useRef();
    const codeRef = useRef();

    const fetchUsers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/rewards/users-points');
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

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
            await axios.post('http://localhost:5000/api/rewards/issue-voucher', payload);
            alert(`Reward sent to ${selectedUser.name}!`);
            
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
                <p className="text-purple-400 font-bold tracking-widest">LOADING REWARDS...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* --- Modern Dark Header --- */}
            <div className="bg-slate-900 text-white pb-20 pt-10 px-6">
                <div className="max-w-5xl mx-auto">
                    <button onClick={() => navigate('/admin-panel')} className="flex items-center text-slate-400 hover:text-white transition mb-8 group">
                        <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" /> 
                        Back to Admin Dashboard
                    </button>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                                <Award className="text-purple-400 h-10 w-10" />
                                Reward Center
                            </h1>
                            <p className="text-slate-400 mt-2 font-medium">Issue digital vouchers and manage citizen EcoPoints.</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                            <p className="text-xs font-bold text-slate-500 uppercase">Total Citizens</p>
                            <p className="text-2xl font-black text-purple-400">{users.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 -mt-10">
                <div className="grid grid-cols-1 gap-8">
                    
                    {/* --- STEP 1: Select User --- */}
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Select a Citizen
                            </h2>
                            {selectedUser && (
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                    User Selected: {selectedUser.name}
                                </span>
                            )}
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {users.map(u => (
                                    <div 
                                        key={u._id} 
                                        onClick={() => setSelectedUser(u)}
                                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group ${
                                            selectedUser?._id === u._id 
                                            ? 'border-purple-600 bg-purple-50' 
                                            : 'border-slate-100 hover:border-purple-200 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${selectedUser?._id === u._id ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{u.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{u.points} PTS</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className={selectedUser?._id === u._id ? 'text-purple-600' : 'text-slate-300'} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* --- STEP 2: Voucher Form --- */}
                    <div className={`bg-white rounded-3xl shadow-2xl border-t-4 border-purple-600 transition-all duration-500 ${!selectedUser ? 'opacity-50 grayscale pointer-events-none scale-[0.98]' : 'opacity-100'}`}>
                        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Configure Reward Voucher
                            </h2>
                        </div>
                        
                        <form onSubmit={handleIssueVoucher} className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Partner Shop Name</label>
                                        <input 
                                            ref={shopRef}
                                            required 
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-medium"
                                            placeholder="e.g. Amazon, local Supermarket"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unique Voucher Code</label>
                                        <input 
                                            ref={codeRef}
                                            required 
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-mono font-bold text-purple-600 uppercase"
                                            placeholder="SAVE-50-ABC"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Discount Value</label>
                                            <input 
                                                ref={amountRef}
                                                required 
                                                type="number"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold"
                                                placeholder="50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pts Required</label>
                                            <input 
                                                ref={costRef}
                                                required 
                                                type="number"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold"
                                                placeholder="1000"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2">
                                        <button 
                                            type="submit" 
                                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-purple-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                        >
                                            <Ticket size={24} />
                                            PUBLISH VOUCHER
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}