import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    Trash2, Weight, Camera, Package, HardHat, Feather, 
    Zap, GlassWater, Recycle, ArrowLeft, MapPin, Info, 
    CheckCircle2, PartyPopper, Trophy, ArrowRight, Leaf,
    Menu, X, ChevronDown, LogOut, Globe, Activity, Bell, Search, UserCircle
} from 'lucide-react'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function LogWaste() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ points: 0 });
    const [formData, setFormData] = useState({
        material: null, 
        estimatedWeight: '', 
        photo: null,
        address: '',
    });
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [photoName, setPhotoName] = useState('No file selected');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const dropdownRef = useRef(null);

    const materialOptions = [
        { type: 'Plastic', icon: Package, color: 'text-blue-600' },
        { type: 'Paper', icon: Feather, color: 'text-orange-600' },
        { type: 'Metal', icon: HardHat, color: 'text-slate-600' },
        { type: 'Glass', icon: GlassWater, color: 'text-emerald-600' },
        { type: 'E-Waste', icon: Zap, color: 'text-purple-600' },
        { type: 'Organic', icon: Recycle, color: 'text-lime-600' },
    ];

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        if (userInfoString) {
            const loggedUser = JSON.parse(userInfoString);
            setUser(loggedUser);
            fetchUserStats(loggedUser._id);
        } else { navigate('/login'); }

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [navigate]);

    const fetchUserStats = async (userId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/stats/${userId}`);
            setUserStats(res.data);
        } catch (error) { console.error("Stats fail"); }
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: name === 'estimatedWeight' ? (value === '' ? '' : parseFloat(value)) : value });
    };

    const handleMaterialSelect = (materialType) => { setFormData({ ...formData, material: materialType }); };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData({ ...formData, photo: file });
        setPhotoName(file ? file.name : 'No file selected');
    };

    const isFormValid = formData.material && formData.address.trim() !== '' && formData.estimatedWeight >= 0.1;
    const potentialPoints = Math.floor((formData.estimatedWeight || 0) * 10);

    const handleLogWaste = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                citizenId: user._id,
                material: formData.material,
                weight: formData.estimatedWeight,
                pickupDetails: { isRequested: false, address: formData.address }
            };
            await axios.post(`${API_BASE_URL}/api/waste/log`, payload);
            setShowSuccess(true);
        } catch (error) { alert("Submission Failed."); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-x-hidden">
            
            {/* --- MASTER NAVBAR (SYNCED) --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex justify-between items-center">
                    
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
                            <div className="bg-[#4CAF50] p-1.5 rounded-lg shadow-md group-hover:rotate-12 transition-transform">
                                <Leaf className="text-white h-5 w-5" />
                            </div>
                            <span className="text-xl font-black tracking-tighter uppercase italic">EcoCycle</span>
                        </div>

                        <nav className="hidden lg:flex items-center gap-8">
                            <button onClick={() => navigate('/home')} className="text-sm font-bold text-slate-500 hover:text-[#4CAF50] transition-colors cursor-pointer">Home</button>
                            <button onClick={() => navigate('/log-waste')} className="text-sm font-bold text-[#4CAF50] cursor-pointer">Log Waste</button>
                            <button onClick={() => user ? navigate('/my-activity') : navigate('/login')} className="text-sm font-bold text-slate-500 hover:text-[#4CAF50] transition-colors cursor-pointer">Pickup Request</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && (
                            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                                <Zap size={14} className="text-yellow-500 fill-yellow-500 animate-pulse" />
                                <span className="text-xs font-black text-yellow-700 uppercase tracking-tighter">{userStats.points} Coins</span>
                            </div>
                        )}

                        {user && (
                            <div className="hidden lg:block relative" ref={dropdownRef}>
                                <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl border bg-white border-slate-200 hover:border-slate-300 transition-all cursor-pointer active:scale-95">
                                    <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-xs shadow-md">{user.name.charAt(0).toUpperCase()}</div>
                                    <div className="text-left leading-none">
                                        <p className="text-[11px] font-black text-slate-800 mb-1 uppercase tracking-tight">{user.name.split(' ')[0]}</p>
                                        <p className="text-[9px] font-bold text-[#4CAF50] uppercase tracking-widest">Member</p>
                                    </div>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
                                        <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                            <p className="text-xs font-black text-slate-900 truncate uppercase">{user.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified Member</p>
                                        </div>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"><LogOut size={16} /> Sign Out</button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="lg:hidden relative w-10 h-10 flex items-center justify-center text-slate-900 bg-slate-100 rounded-xl active:scale-90 transition-all cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            <div className={`transition-transform duration-500 ${isMobileMenuOpen ? 'rotate-[360deg]' : 'rotate-0'}`}>
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </div>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow pt-24 pb-12 flex items-center justify-center p-3 md:p-6">
                <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <form onSubmit={handleLogWaste} className="flex flex-col lg:flex-row">
                        <div className="lg:w-5/12 p-8 md:p-12 bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-100 text-center lg:text-left">
                            <div className="mb-10">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">Identify Waste</h2>
                                <p className="text-[10px] text-[#4CAF50] font-black uppercase tracking-[0.2em]">Material Mapping Node</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {materialOptions.map(({ type, icon: Icon, color }) => (
                                    <button key={type} type="button" onClick={() => handleMaterialSelect(type)} className={`group flex flex-col items-center justify-center p-6 rounded-[2rem] transition-all border-4 duration-300 active:scale-95 cursor-pointer ${formData.material === type ? 'border-[#4CAF50] bg-white shadow-xl scale-[1.02]' : `bg-white border-transparent hover:border-slate-200`}`}>
                                        <Icon className={`h-8 w-8 ${color} mb-3 group-hover:rotate-12 transition-transform`} />
                                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-none">{type}</p>
                                        {formData.material === type && <CheckCircle2 className="mt-2 text-[#4CAF50] h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="lg:w-7/12 p-8 md:p-12 flex flex-col justify-center space-y-8">
                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-slate-400 flex items-center gap-3 border-b border-slate-100 pb-4 uppercase tracking-[0.2em] cursor-default"><Info className="text-[#4CAF50]" size={18} /> Documentation Hub</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-default">Mass (KG)</label>
                                        <div className="relative group"><Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#4CAF50]" size={20} />
                                            <input name="estimatedWeight" type="number" step="0.1" placeholder="0.0" value={formData.estimatedWeight} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] transition-all text-lg font-black outline-none cursor-text" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-default">Evidence</label>
                                        <label className="flex items-center gap-3 h-[64px] px-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#4CAF50] transition-all cursor-pointer">
                                            <Camera className="text-slate-400" size={20} /><span className="text-[10px] font-bold text-slate-500 uppercase truncate italic">{photoName}</span>
                                            <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 cursor-default">Pickup Address</label>
                                    <div className="relative group"><MapPin className="absolute left-4 top-4 text-slate-300 group-focus-within:text-[#4CAF50]" size={20} />
                                        <textarea name="address" value={formData.address} onChange={handleChange} rows="3" className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-[#4CAF50] transition-all text-sm font-bold outline-none resize-none cursor-text" placeholder="Detailed coordinates for collection..." required />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={loading || !isFormValid} className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 shadow-xl active:scale-95 cursor-pointer ${isFormValid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}>{loading ? 'PROCESSING...' : 'AUTHORIZE LOG'}</button>
                        </div>
                    </form>
                </div>
            </main>

            {/* MOBILE DROPDOWN (SYNCED) */}
            <div className={`lg:hidden fixed top-16 left-0 right-0 z-[90] bg-white border-b border-slate-200 shadow-2xl transition-all duration-300 ease-in-out origin-top ${isMobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
                <div className="p-6 flex flex-col gap-4">
                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-2">
                            <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-[#4CAF50] font-black text-xl">{user.name.charAt(0).toUpperCase()}</div>
                            <div>
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{user.name}</p>
                                <p className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest">Authorized Member</p>
                            </div>
                        </div>
                    )}
                    <button onClick={() => {navigate('/home'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Home</button>
                    <button onClick={() => {navigate('/log-waste'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Log Waste</button>
                    <button onClick={() => {navigate('/my-activity'); setIsMobileMenuOpen(false);}} className="text-lg font-black text-slate-900 uppercase tracking-tighter text-left py-3 border-b border-slate-50 cursor-pointer">Pickup Request</button>
                    {user ? <button onClick={handleLogout} className="p-4 bg-rose-50 text-rose-500 rounded-2xl text-sm font-black uppercase mt-2 cursor-pointer">Sign Out</button> : <button onClick={() => navigate('/login')} className="p-4 bg-[#4CAF50] text-white rounded-2xl text-sm font-black uppercase cursor-pointer">Sign In</button>}
                </div>
            </div>
        </div>
    );
}