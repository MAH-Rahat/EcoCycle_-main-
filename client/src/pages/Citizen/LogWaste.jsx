import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Trash2, Weight, Camera, Package, HardHat, Feather, 
    Zap, GlassWater, Recycle, ArrowLeft, MapPin, Info, 
    CheckCircle2, PartyPopper, Trophy, ArrowRight
} from 'lucide-react'; 

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
    
    // Points calculation (matches your backend logic: 10 points per KG)
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

            await axios.post('http://localhost:5000/api/waste/log', payload);
            setShowSuccess(true); // Show the custom modal instead of alert
        } catch (error) {
            alert("Submission Failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-700 overflow-x-hidden laptop:overflow-hidden relative">
            
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-teal-600 p-1.5 rounded-lg shadow-md shadow-teal-100">
                            <Recycle className="text-white h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-800 uppercase italic">EcoCycle</span>
                    </div>
                    <button onClick={() => navigate('/home')} className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-all font-semibold text-sm">
                        <ArrowLeft size={16} />
                        <span>BACK</span>
                    </button>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-4 lg:p-6">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl border border-slate-100 overflow-hidden animate-fadeIn">
                    <form onSubmit={handleLogWaste} className="flex flex-col lg:flex-row">
                        
                        {/* Left Side: selection */}
                        <div className="lg:w-1/2 p-6 lg:p-10 bg-slate-50/50 border-r border-slate-100">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 leading-tight">Identify Material</h2>
                                <p className="text-sm text-slate-500 font-medium">Select the available recycling category.</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {materialOptions.map(({ type, icon: Icon, color, bgColor }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleMaterialSelect(type)}
                                        className={`group flex flex-col items-center justify-center p-4 rounded-2xl transition-all border-2 duration-200
                                            ${formData.material === type 
                                                ? 'border-teal-600 bg-teal-50 shadow-md scale-[1.02]' 
                                                : `bg-white border-slate-100 hover:border-teal-400 hover:bg-slate-50 hover:scale-[1.02]`
                                            }`}
                                    >
                                        <Icon className={`h-8 w-8 ${color} mb-2 group-hover:scale-110 transition-transform`} />
                                        <p className="text-[13px] font-bold text-slate-700 uppercase tracking-tight">{type}</p>
                                        {formData.material === type && <CheckCircle2 className="mt-1 text-teal-600 h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Side: Inputs */}
                        <div className="lg:w-1/2 p-6 lg:p-10 flex flex-col justify-between space-y-6">
                            <div className="space-y-5">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                                    <Info className="text-teal-600" size={18} /> Log Details
                                </h3>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Estimated Mass (KG)</label>
                                    <div className="relative">
                                        <Weight className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            name="estimatedWeight"
                                            type="number"
                                            step="0.1"
                                            placeholder="Enter weight in kg"
                                            value={formData.estimatedWeight}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-base font-medium outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Location Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            rows="2"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-sm font-medium outline-none resize-none"
                                            placeholder="Specify where the items are located"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Photo Attachment</label>
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 transition-colors">
                                        <label className="cursor-pointer bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold hover:bg-slate-900 hover:text-white transition-all">
                                            BROWSE
                                            <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                                        </label>
                                        <span className="text-[12px] font-medium text-slate-400 truncate flex-1 italic">{photoName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || !isFormValid}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all duration-300 shadow-lg
                                        ${isFormValid 
                                            ? 'bg-teal-600 text-white hover:bg-slate-900 shadow-teal-100 active:scale-[0.98]' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    {loading ? 'SYNCING...' : 'CONFIRM LOG ENTRY'}
                                </button>
                                {!isFormValid && (
                                    <p className="text-center text-[11px] font-semibold text-rose-500 mt-3 italic animate-pulse">
                                        * Select Category, Weight, and Address
                                    </p>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </main>

            {/* --- CUSTOM SUCCESS MODAL --- */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-teal-100 text-center scale-up-center">
                        <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <PartyPopper size={40} className="animate-bounce" />
                        </div>
                        
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Congratulations!</h3>
                        <p className="text-slate-500 font-medium mb-6">Your request has been successfully logged.</p>
                        
                        <div className="bg-slate-50 rounded-2xl p-5 mb-8 space-y-3 text-left">
                            <div className="flex justify-between items-center text-sm font-bold border-b border-slate-200 pb-2">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">Category</span>
                                <span className="text-teal-600">{formData.material}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold border-b border-slate-200 pb-2">
                                <span className="text-slate-400 uppercase tracking-widest text-[10px]">Amount</span>
                                <span className="text-slate-700">{formData.estimatedWeight} KG</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <div className="flex items-center gap-2">
                                    <Trophy size={14} className="text-amber-500" />
                                    <span className="text-slate-400 uppercase tracking-widest text-[10px]">Potential Reward</span>
                                </div>
                                <span className="text-amber-600 font-black">{potentialPoints} Points</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed">
                            Points will be credited to your account once the admin verifies and accepts your request.
                        </p>

                        <button 
                            onClick={() => navigate('/home')}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-600 transition-colors shadow-lg active:scale-95"
                        >
                            Return Home <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
                
                .scale-up-center { animation: scale-up-center 0.3s cubic-bezier(0.390, 0.575, 0.565, 1.000) both; }
                @keyframes scale-up-center {
                    0% { transform: scale(0.5); transform-origin: center; opacity: 0; }
                    100% { transform: scale(1); transform-origin: center; opacity: 1; }
                }

                @media (min-height: 800px) and (min-width: 1024px) {
                    .laptop\:overflow-hidden { overflow: hidden; }
                }
            `}</style>
        </div>
    );
}