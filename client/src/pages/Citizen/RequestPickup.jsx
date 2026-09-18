import React, { useState } from 'react';
import axios from 'axios';
import { Truck, Calendar, Clock, MapPin, X, ShieldCheck, ArrowRight, ChevronDown, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RequestPickup({ wasteId, onClose }) {
    const user = JSON.parse(localStorage.getItem('userInfo'));
    const [formData, setFormData] = useState({
        address: '',
        scheduledDate: '',
        timeSlot: 'Morning'
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        
        if (!user?._id) {
            setErrorMessage("Session expired. Please login again.");
            return;
        }
        
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            await axios.post(`${API_BASE_URL}/api/pickup/schedule`, {
                address: formData.address,
                scheduledTime: formData.scheduledDate,
                timeSlot: formData.timeSlot,
                citizenId: user._id,
                wasteLogIds: wasteId ? [wasteId] : []
            }, { headers });

            setSuccessMessage("Pickup request successfully sent to mission control!");
            setTimeout(() => {
                onClose(); 
            }, 1500);
        } catch (error) {
            console.error(error);
            setErrorMessage(error.response?.data?.message || "Failed to schedule pickup.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center z-[999] p-0 md:p-4 custom-fade-in">
            <div className="bg-white w-full max-w-lg p-8 md:p-12 rounded-t-[2.5rem] md:rounded-[3.5rem] shadow-2xl relative custom-slide-up border-t md:border border-slate-100">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-8 p-2.5 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all active:scale-75 cursor-pointer z-10"
                >
                    <X className="h-5 w-5" />
                </button>

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

                {successMessage ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-3xl text-center space-y-4 my-6 animate-scaleIn">
                        <CheckCircle2 className="mx-auto text-emerald-600 h-14 w-14 animate-bounce" />
                        <h3 className="text-xl font-black text-emerald-900 tracking-tight">SUCCESS!</h3>
                        <p className="text-sm font-bold text-emerald-700">{successMessage}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {errorMessage && (
                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-600 text-xs font-bold uppercase tracking-wide">
                                {errorMessage}
                            </div>
                        )}

                        <div className="group">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Collection Point</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors" />
                                <input 
                                    required
                                    className="w-full pl-12 pr-4 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-bold text-base cursor-text text-slate-900"
                                    placeholder="Street, Block, City"
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Arrival Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors z-10 pointer-events-none" />
                                    <input 
                                        type="date"
                                        required
                                        className="w-full pl-12 pr-4 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-bold text-sm cursor-pointer text-slate-900"
                                        onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="group relative">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Time Protocol</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-[#4CAF50] transition-colors z-10 pointer-events-none" />
                                    <select 
                                        className="w-full pl-12 pr-12 h-[58px] md:h-[68px] bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] outline-none transition-all font-black text-sm appearance-none cursor-pointer text-slate-900"
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
                )}
            </div>
        </div>
    );
}