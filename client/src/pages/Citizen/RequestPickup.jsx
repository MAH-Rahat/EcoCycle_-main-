import React, { useState } from 'react';
import axios from 'axios';
import { Truck, Calendar, Clock, MapPin, X, ShieldCheck, ArrowRight, ChevronDown } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RequestPickup({ wasteId, onClose }) {
    const user = JSON.parse(localStorage.getItem('userInfo'));
    const [formData, setFormData] = useState({
        address: '',
        scheduledDate: '',
        timeSlot: 'Morning'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user?._id) return alert("Session expired. Please login again.");
        
        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/api/pickup/schedule`, {
                ...formData,
                citizen: user._id,
                wasteItem: wasteId
            });
            alert("Pickup request successfully sent to mission control!");
            onClose(); 
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to schedule pickup.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center z-[999] p-0 md:p-4 custom-fade-in">
            
            {/* Modal Container: Increased max-width to max-w-lg to ensure the full line fits */}
            <div className="bg-white w-full max-w-lg p-8 md:p-12 rounded-t-[2.5rem] md:rounded-[3.5rem] shadow-2xl relative custom-slide-up border-t md:border border-slate-100">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-8 p-2.5 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all active:scale-75 cursor-pointer z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-green-50 p-3.5 rounded-2xl">
                            <Truck className="text-[#4CAF50] h-7 w-7" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
                            Schedule <span className="text-[#4CAF50]">Truck</span>
                        </h2>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Logistics Authorization Node</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Collection Point */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Collection Point</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors" />
                            <input 
                                required
                                className="w-full pl-12 pr-4 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-bold text-base cursor-text"
                                placeholder="Street, Block, City"
                                value={formData.address}
                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Date & Slot */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="group">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Arrival Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors z-10 pointer-events-none" />
                                <input 
                                    type="date"
                                    required
                                    className="w-full pl-12 pr-4 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-bold text-sm cursor-pointer"
                                    onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="group relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Time Protocol</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors z-10 pointer-events-none" />
                                {/* FIXED: Increased inner padding-right (pr-12) and minimum width to prevent line cutting */}
                                <select 
                                    className="w-full pl-12 pr-12 h-[58px] md:h-[68px] bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-black text-sm appearance-none cursor-pointer"
                                    value={formData.timeSlot}
                                    onChange={(e) => setFormData({...formData, timeSlot: e.target.value})}
                                >
                                    <option value="Morning">Morning (8 AM - 12 PM)</option>
                                    <option value="Afternoon">Afternoon (12 PM - 4 PM)</option>
                                    <option value="Evening">Evening (4 PM - 8 PM)</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100 flex items-start gap-4">
                        <ShieldCheck className="text-[#4CAF50] h-6 w-6 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-green-700 font-bold leading-relaxed uppercase tracking-tight">
                            Mission Confirmation: Physical collection unit will arrive at coordinates.
                        </p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-5 md:py-6 rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer
                            ${loading 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                : 'bg-[#4CAF50] text-white hover:bg-black shadow-green-100 hover:shadow-slate-300'}`}
                    >
                        {loading ? 'SYNCING...' : (
                            <>
                                <span>AUTHORIZE PICKUP</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                {/* Internal CSS for GUARANTEED Smooth Animations */}
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes backdropIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes modalEliteIn {
                        from { transform: translateY(60px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                    .custom-fade-in {
                        animation: backdropIn 0.4s ease-out forwards;
                    }
                    .custom-slide-up {
                        animation: modalEliteIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    /* Ensure select menu items look clean */
                    select option {
                        font-weight: bold;
                        padding: 10px;
                    }
                `}} />
            </div>
        </div>
    );
}