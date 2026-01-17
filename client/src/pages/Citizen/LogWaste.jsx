import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Trash2, Weight, Camera, Package, HardHat, Feather, 
    Zap, GlassWater, Recycle, ArrowLeft, MapPin, Info, 
    CheckCircle2, PartyPopper, Trophy, ArrowRight, Leaf
} from 'lucide-react'; 

// --- DUAL MODE URL CONFIG ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function LogWaste() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        material: null, 
        estimatedWeight: '', 
        photo: null,
        address: '',
    });
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [photoName, setPhotoName] = useState('No file selected');

    const materialOptions = [
        { type: 'Plastic', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        { type: 'Paper', icon: Feather, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        { type: 'Metal', icon: HardHat, color: 'text-slate-600', bgColor: 'bg-slate-100' },
        { type: 'Glass', icon: GlassWater, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        { type: 'E-Waste', icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        { type: 'Organic', icon: Recycle, color: 'text-lime-600', bgColor: 'bg-lime-50' },
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: name === 'estimatedWeight' ? (value === '' ? '' : parseFloat(value)) : value });
    };

    const handleMaterialSelect = (materialType) => {
        setFormData({ ...formData, material: materialType });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData({ ...formData, photo: file });
        setPhotoName(file ? file.name : 'No file selected');
    };

    const isFormValid = formData.material && formData.address.trim() !== '' && formData.estimatedWeight >= 0.1;
    const potentialPoints = Math.floor((formData.estimatedWeight || 0) * 10);

    const handleLogWaste = async (e) => {
        e.preventDefault();
        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        if (!userInfo?._id) return navigate('/login');

        setLoading(true);
        try {
            const payload = {
                citizenId: userInfo._id,
                material: formData.material,
                weight: formData.estimatedWeight,
                pickupDetails: {
                    isRequested: false, 
                    address: formData.address
                }
            };

            // Using Dynamic API URL
            await axios.post(`${API_BASE_URL}/api/waste/log`, payload);
            setShowSuccess(true);
        } catch (error) {
            console.error(error);
            alert("Submission Failed. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-700 overflow-x-hidden">
            
            {/* Responsive Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 sticky top-0 z-40 backdrop-blur-md bg-white/95">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2 italic">
                        <Leaf className="text-teal-600 h-6 w-6" />
                        <span className="text-lg md:text-xl font-black tracking-tighter text-slate-800 uppercase">EcoCycle</span>
                    </div>
                    <button onClick={() => navigate('/home')} className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-all font-black text-xs md:text-sm uppercase tracking-widest active:scale-95">
                        <ArrowLeft size={16} />
                        <span>BACK</span>
                    </button>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-3 md:p-6">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl border border-slate-100 overflow-hidden animate-fadeIn">
                    <form onSubmit={handleLogWaste} className="flex flex-col lg:flex-row">
                        
                        {/* Left Side: Category Selection */}
                        <div className="lg:w-5/12 p-6 md:p-10 bg-slate-50/80 border-b lg:border-b-0 lg:border-r border-slate-100">
                            <div className="mb-8 text-center lg:text-left">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">Identify Material</h2>
                                <p className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Select the recycling category</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 md:gap-4">
                                {materialOptions.map(({ type, icon: Icon, color, bgColor }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleMaterialSelect(type)}
                                        className={`group flex flex-col items-center justify-center p-5 rounded-[2rem] transition-all border-4 duration-300
                                            ${formData.material === type 
                                                ? 'border-teal-600 bg-white shadow-xl shadow-teal-100 scale-[1.05]' 
                                                : `bg-white/50 border-transparent hover:border-teal-200 hover:bg-white`
                                            }`}
                                    >
                                        <Icon className={`h-8 w-8 ${color} mb-2 group-hover:scale-110 transition-transform`} />
                                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{type}</p>
                                        {formData.material === type && <CheckCircle2 className="mt-1 text-teal-600 h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Side: Inputs */}
                        <div className="lg:w-7/12 p-6 md:p-10 flex flex-col justify-center space-y-6">
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-3 uppercase tracking-[0.2em]">
                                    <Info className="text-teal-600" size={18} /> Documentation Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimated Mass (KG)</label>
                                        <div className="relative group">
                                            <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={20} />
                                            <input
                                                name="estimatedWeight"
                                                type="number"
                                                step="0.1"
                                                placeholder="0.0"
                                                value={formData.estimatedWeight}
                                                onChange={handleChange}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-teal-500 transition-all text-lg font-black outline-none"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo Signal</label>
                                        <div className="relative h-[60px]">
                                            <label className="flex items-center gap-3 h-full px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-teal-400 transition-all cursor-pointer overflow-hidden">
                                                <Camera className="text-slate-400 flex-shrink-0" size={20} />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate italic">
                                                    {photoName}
                                                </span>
                                                <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Coordinates (Address)</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-4 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={20} />
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            rows="3"
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-teal-500 transition-all text-sm font-bold outline-none resize-none"
                                            placeholder="Where should the collector arrive?"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || !isFormValid}
                                    className={`w-full py-5 rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-xl active:scale-95
                                        ${isFormValid 
                                            ? 'bg-slate-900 text-white hover:bg-teal-600 shadow-teal-100' 
                                            : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    {loading ? 'SYNCHRONIZING...' : 'AUTHORIZE LOG ENTRY'}
                                </button>
                                {!isFormValid && (
                                    <p className="text-center text-[10px] font-black text-rose-500 mt-4 uppercase tracking-tighter animate-pulse">
                                        * Complete all mandatory fields to proceed
                                    </p>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </main>

            {/* --- SUCCESS OVERLAY --- */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white rounded-[3rem] w-full max-w-md p-8 md:p-12 shadow-2xl text-center scale-up-center border border-teal-50">
                        <div className="w-24 h-24 bg-teal-50 text-teal-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <PartyPopper size={48} className="animate-bounce" />
                        </div>
                        
                        <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter italic">Log Authorized!</h3>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-8">Mission contribution recorded</p>
                        
                        <div className="bg-slate-50 rounded-[2rem] p-6 mb-8 space-y-4">
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest border-b border-slate-200 pb-3">
                                <span className="text-slate-400">Material</span>
                                <span className="text-teal-600 italic">{formData.material}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <Trophy size={16} className="text-amber-500" />
                                    <span className="text-slate-400">Yield</span>
                                </div>
                                <span className="text-amber-600">+{potentialPoints} EcoPoints</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate('/home')}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-teal-600 transition-all active:scale-95 shadow-2xl"
                        >
                            RETURN TO HUB <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
            
            <style jsx="true">{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
                .scale-up-center { animation: scale-up-center 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
                @keyframes scale-up-center {
                    0% { transform: scale(0.7); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}