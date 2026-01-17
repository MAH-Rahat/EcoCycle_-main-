import React, { useState } from 'react';
import axios from 'axios';
import { Truck, Calendar, Clock, MapPin, X, ShieldCheck } from 'lucide-react';

// --- DUAL MODE URL CONFIG ---
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
            // Using Dynamic API URL
            await axios.post(`${API_BASE_URL}/api/pickup/schedule`, {
                ...formData,
                citizen: user._id,
                wasteItem: wasteId
            });
            
            alert("Pickup request successfully sent to mission control!");
            onClose(); 
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to schedule pickup. Check your connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-fadeIn">
            {/* Modal Container: Slid-up on mobile, centered on desktop */}
            <div className="bg-white w-full max-w-md p-6 md:p-10 rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl relative animate-slideUp md:animate-scaleIn border-t md:border border-gray-100">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-gray-50 text-gray-400 hover:text-rose-500 rounded-full transition-all active:scale-90"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-lime-50 p-2.5 rounded-2xl">
                            <Truck className="text-[#84CC16] h-6 w-6" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tighter italic uppercase">Schedule <span className="text-[#84CC16]">Truck</span></h2>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Logistics Authorization</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Address Input */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Collection Point</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-[#84CC16] transition-colors" />
                            <input 
                                required
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-[#84CC16] outline-none transition-all font-bold text-sm"
                                placeholder="Street, Block, City"
                                value={formData.address}
                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Date & Slot Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Arrival Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-[#84CC16] transition-colors z-10 pointer-events-none" />
                                <input 
                                    type="date"
                                    required
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-[#84CC16] outline-none transition-all font-bold text-sm"
                                    onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Time Protocol</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-[#84CC16] transition-colors z-10 pointer-events-none" />
                                <select 
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-[#84CC16] outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
                                    value={formData.timeSlot}
                                    onChange={(e) => setFormData({...formData, timeSlot: e.target.value})}
                                >
                                    <option value="Morning">Morning (8-12)</option>
                                    <option value="Afternoon">Afternoon (12-4)</option>
                                    <option value="Evening">Evening (4-8)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-lime-50/50 p-4 rounded-2xl border border-lime-100 flex items-start gap-3 mb-2">
                        <ShieldCheck className="text-[#84CC16] h-5 w-5 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-lime-700 font-bold leading-relaxed uppercase tracking-tight">
                            By confirming, you authorize our ecological collectors to arrive at the specified coordinates.
                        </p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-lime-900/10 transition-all active:scale-95 flex items-center justify-center gap-2
                            ${loading 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-[#84CC16] text-black hover:bg-black hover:text-white'}`}
                    >
                        {loading ? 'PROCESSING SIGNAL...' : 'AUTHORIZE PICKUP'}
                    </button>
                </form>
            </div>

            <style jsx="true">{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slideUp { animation: slideUp 0.4s ease-out forwards; }
                
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scaleIn { animation: scaleIn 0.3s ease-out forwards; }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
}