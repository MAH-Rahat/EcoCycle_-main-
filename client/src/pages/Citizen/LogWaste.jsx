import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Trash2, Weight, Camera, Package, HardHat, Feather, 
    Zap, GlassWater, Recycle, ArrowLeft, MapPin, Info, 
    CheckCircle2, PartyPopper, Trophy, ArrowRight, Leaf,
    Menu, X, ChevronDown, LogOut, Globe, Activity, Bell, Search, UserCircle,
    Github, Mail, AlertCircle, Map, Navigation
} from 'lucide-react'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const BANGLADESH_DIVISIONS = [
    "Barishal", "Chittagong", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"
];

const AREAS_BY_DIVISION = {
    "Dhaka": ["Gulshan", "Banani", "Dhanmondi", "Uttara", "Mirpur", "Motijheel", "Badda", "Mohammadpur", "Khilgaon", "Other"],
    "Chittagong": ["Agrabad", "Halishahar", "Nasirabad", "Pahartali", "Kotwali", "Patenga", "Other"],
    "Sylhet": ["Zindabazar", "Bandar Bazar", "Amberkhana", "Shibganj", "Subid Bazar", "Other"],
    "Rajshahi": ["Shaheb Bazar", "Motihar", "Boalia", "Rajpara", "Kazla", "Other"],
    "Khulna": ["Sonadanga", "Khalishpur", "Daulatpur", "Boyra", "Nirala", "Other"],
    "Barishal": ["Sadar", "Rupatali", "Nathullabad", "Amanatganj", "Other"],
    "Rangpur": ["Sadar", "Tajhat", "Mahiganj", "Dhap", "Other"],
    "Mymensingh": ["Sadar", "Valuka", "Trishal", "Muktagacha", "Other"]
};

export default function LogWaste() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ points: 0 });
    const [formData, setFormData] = useState({
        material: null, 
        estimatedWeight: '', 
        photo: null
    });
    
    const [locationData, setLocationData] = useState({
        division: '',
        area: '',
        customArea: '',
        street: ''
    });

    const [loading, setLoading] = useState(false);
    const [isButtonSuccess, setIsButtonSuccess] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [photoName, setPhotoName] = useState('No file selected');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const dropdownRef = useRef(null);

    const materialOptions = [
        { type: 'Plastic', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
        { type: 'Paper', icon: Feather, color: 'text-orange-500', bg: 'bg-orange-50' },
        { type: 'Metal', icon: HardHat, color: 'text-gray-600', bg: 'bg-gray-100' },
        { type: 'Glass', icon: GlassWater, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { type: 'E-Waste', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
        { type: 'Organic', icon: Recycle, color: 'text-[#22c55e]', bg: 'bg-green-50' },
    ];

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        if (userInfoString) {
            const loggedUser = JSON.parse(userInfoString);
            setUser(loggedUser);
            fetchUserStats(loggedUser._id);
        } else { 
            navigate('/login'); 
        }

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
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/waste/stats/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserStats(res.data);
        } catch (error) { 
            console.error("Stats fail"); 
        }
    };

    const handleNavigate = (path) => {
        if (window.location.pathname === path) return;
        setIsExiting(true);
        setTimeout(() => navigate(path), 400);
    };

    const handleLogout = () => {
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            localStorage.removeItem('token');
            setUser(null);
            navigate('/');
            setIsMobileMenuOpen(false);
        }, 800);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: name === 'estimatedWeight' ? (value === '' ? '' : parseFloat(value)) : value });
        if (errorMsg) setErrorMsg(null); 
    };

    const handleLocationChange = (e) => {
        const { name, value } = e.target;
        if (name === 'division') {
            setLocationData({ ...locationData, division: value, area: '', customArea: '' });
        } else {
            setLocationData({ ...locationData, [name]: value });
        }
        if (errorMsg) setErrorMsg(null);
    };

    const handleMaterialSelect = (materialType) => { 
        setFormData({ ...formData, material: materialType }); 
        if (errorMsg) setErrorMsg(null); 
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData({ ...formData, photo: file });
        setPhotoName(file ? file.name : 'No file selected');
    };

    const isFormValid = 
        formData.material && 
        formData.estimatedWeight >= 0.1 &&
        locationData.division !== '' &&
        locationData.area !== '' &&
        (locationData.area !== 'Other' || locationData.customArea.trim() !== '') &&
        locationData.street.trim() !== '';

    const potentialPoints = Math.floor((formData.estimatedWeight || 0) * 10);

    const handleLogWaste = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        
        const token = localStorage.getItem('token');
        if (!token) {
            setErrorMsg("Authentication token missing. Please log in again.");
            setLoading(false);
            return;
        }

        try {
            const finalArea = locationData.area === 'Other' ? locationData.customArea.trim() : locationData.area;
            const fullFormattedAddress = `${locationData.street.trim()}, ${finalArea}, ${locationData.division}`;

            const payload = {
                citizenId: user._id,
                material: formData.material,
                weight: formData.estimatedWeight,
                photo: null,
                pickupDetails: { address: fullFormattedAddress }
            };
            
            await axios.post(`${API_BASE_URL}/api/waste/legacy/log`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setLoading(false);
            setIsButtonSuccess(true);
            setTimeout(() => {
                setShowSuccess(true);
                setIsButtonSuccess(false);
            }, 800);

        } catch (error) { 
            console.error("Submission Error:", error.response || error);
            setErrorMsg(error.response?.data?.message || "Failed to connect to the server."); 
            setLoading(false);
        }
    };

    const resetFormState = () => {
        setShowSuccess(false); 
        setFormData({ material: null, estimatedWeight: '', photo: null }); 
        setLocationData({ division: '', area: '', customArea: '', street: '' });
        setPhotoName('No file selected');
        setErrorMsg(null);
    };

    return (
        <div className={`min-h-screen font-sans flex flex-col overflow-x-hidden bg-[#F4F9F5] text-[#051F20] transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            
            {/* --- DEEP ECO NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle</span>
                        </div>

                        <nav className="hidden lg:flex items-center gap-8">
                            <button onClick={() => handleNavigate('/home')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] active:scale-95 transition-all duration-300 cursor-pointer">Home</button>
                            <button onClick={() => handleNavigate('/log-waste')} className="text-sm font-semibold text-white hover:text-[#22c55e] active:scale-95 transition-all duration-300 cursor-pointer">Log Waste</button>
                            <button onClick={() => user ? handleNavigate('/my-activity') : handleNavigate('/login')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] active:scale-95 transition-all duration-300 cursor-pointer">Pickup Request</button>
                            <button onClick={() => handleNavigate('/projects')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] active:scale-95 transition-all duration-300 cursor-pointer">Initiatives</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        {user ? (
                            <div className="hidden lg:block relative" ref={dropdownRef}>
                                <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all duration-300">
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-white group-hover:text-[#22c55e] transition-colors">{user.name.split(' ')[0]}</p>
                                        <p className="text-xs text-[#8EB69B]">{userStats.points} Impact</p>
                                    </div>
                                    <div className="h-10 w-10 bg-[#163832] border border-[#235347] rounded-full flex items-center justify-center text-[#22c55e] font-bold group-hover:bg-[#22c55e] group-hover:text-[#051F20] transition-colors duration-300">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-4 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-50 animate-scaleIn origin-top-right">
                                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#163832] hover:bg-[#F4F9F5] rounded-lg transition-all cursor-pointer"><UserCircle size={18} /> Profile</button>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"><LogOut size={18} /> Sign Out</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => handleNavigate('/login')} className="hidden lg:block bg-[#22c55e] text-[#051F20] px-8 py-3.5 rounded-sm text-sm font-bold hover:bg-white hover:text-[#051F20] active:scale-95 transition-all duration-300 cursor-pointer">
                                Log In
                            </button>
                        )}
                        
                        <button className="lg:hidden text-white hover:text-[#22c55e] active:scale-90 transition-all duration-300 cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-grow pt-40 pb-24 px-4 md:px-8 max-w-6xl mx-auto w-full relative z-10">
                
                {showSuccess ? (
                    <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 p-12 text-center animate-scaleIn max-w-2xl mx-auto mt-10">
                        <div className="w-24 h-24 bg-[#F4F9F5] rounded-full flex items-center justify-center mx-auto mb-8 relative animate-float">
                            <PartyPopper size={40} className="text-[#22c55e]" />
                            <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center animate-bounce">
                                <Zap size={16} className="text-yellow-500 fill-yellow-500" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-[#051F20] mb-4">Waste Logged Successfully!</h2>
                        <p className="text-[#235347] text-sm mb-8 leading-relaxed">
                            Thank you for protecting our planet. Your request has been transmitted to administrative logs.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onClick={() => handleNavigate('/my-activity')} className="bg-white text-[#051F20] border border-gray-200 px-8 py-3.5 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition-all cursor-pointer text-xs uppercase tracking-wider">
                                View My Activity
                            </button>
                            <button onClick={resetFormState} className="bg-[#22c55e] text-[#051F20] px-8 py-3.5 rounded-xl font-bold hover:bg-[#051F20] hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider shadow-sm">
                                Log More Waste <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(5,31,32,0.03)] w-full border border-gray-100 overflow-hidden flex flex-col lg:flex-row">
                        
                        {/* LEFT COLUMN: Material Selection */}
                        <div className="lg:w-5/12 p-8 md:p-12 bg-[#F4F9F5] border-b lg:border-b-0 lg:border-r border-gray-100">
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold text-[#051F20] tracking-tight mb-2">
                                    {user ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Identify Waste'}
                                </h2>
                                <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Select the primary material for collection.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {materialOptions.map(({ type, icon: Icon, color, bg }, index) => (
                                    <button 
                                        key={type} 
                                        type="button" 
                                        onClick={() => handleMaterialSelect(type)} 
                                        className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden active:scale-95 ${formData.material === type ? 'bg-white border-2 border-[#22c55e] shadow-sm scale-[1.02]' : 'bg-white border border-gray-100 hover:border-[#22c55e]/40 shadow-sm'}`}
                                    >
                                        {formData.material === type && <div className="absolute inset-0 bg-[#22c55e]/5 z-0 pointer-events-none"></div>}
                                        
                                        <div className={`p-3 rounded-xl ${bg} mb-3 z-10 transition-transform duration-300 group-hover:scale-110`}>
                                            <Icon className={`h-6 w-6 ${color}`} strokeWidth={2} />
                                        </div>
                                        <p className="text-xs font-bold text-[#051F20] z-10 uppercase tracking-wider">{type}</p>
                                        
                                        {formData.material === type && (
                                            <div className="absolute top-3 right-3 z-10">
                                                <CheckCircle2 className="text-[#22c55e] h-4 w-4 bg-white rounded-full" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Details & Structured Location */}
                        <div className="lg:w-7/12 p-8 md:p-12 flex flex-col justify-center space-y-8">
                            <form onSubmit={handleLogWaste} className="space-y-6">
                                
                                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                    <div className="bg-[#22c55e]/10 p-2 rounded-xl text-[#22c55e]"><Info size={16} /></div>
                                    <h3 className="text-xs font-bold text-[#051F20] uppercase tracking-wider">Collection Metrics</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Estimated Weight (kg)</label>
                                        <div className="relative group">
                                            <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#22c55e] transition-colors" size={18} />
                                            <input 
                                                name="estimatedWeight" 
                                                type="number" 
                                                step="0.1" 
                                                placeholder="0.0" 
                                                value={formData.estimatedWeight} 
                                                onChange={handleChange} 
                                                className="w-full pl-12 pr-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all text-sm font-bold outline-none text-[#051F20] placeholder:text-gray-400" 
                                                required 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Photo Evidence</label>
                                        <label className="flex items-center gap-3 h-[50px] px-4 bg-[#F4F9F5] rounded-xl border border-dashed border-gray-300 hover:border-[#22c55e] transition-all cursor-pointer group">
                                            <Camera className="text-gray-400 group-hover:text-[#22c55e] shrink-0" size={18} />
                                            <span className="text-xs font-medium text-[#235347] truncate">{photoName}</span>
                                            <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-[#22c55e]/10 p-2 rounded-xl text-[#22c55e]"><Map size={16} /></div>
                                        <h3 className="text-xs font-bold text-[#051F20] uppercase tracking-wider">Pickup Logistics</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Division</label>
                                            <div className="relative">
                                                <select 
                                                    name="division" 
                                                    value={locationData.division} 
                                                    onChange={handleLocationChange} 
                                                    className="w-full pl-4 pr-10 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all text-sm font-bold outline-none text-[#051F20] appearance-none cursor-pointer" 
                                                    required
                                                >
                                                    <option value="" disabled>Select Division</option>
                                                    {BANGLADESH_DIVISIONS.map(div => (
                                                        <option key={div} value={div}>{div}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Area / Place</label>
                                            <div className="relative">
                                                <select 
                                                    name="area" 
                                                    value={locationData.area} 
                                                    onChange={handleLocationChange} 
                                                    disabled={!locationData.division}
                                                    className="w-full pl-4 pr-10 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all text-sm font-bold outline-none text-[#051F20] appearance-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
                                                    required
                                                >
                                                    <option value="" disabled>Select Area</option>
                                                    {locationData.division && AREAS_BY_DIVISION[locationData.division]?.map(area => (
                                                        <option key={area} value={area}>{area}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                            </div>
                                        </div>
                                    </div>

                                    {locationData.area === 'Other' && (
                                        <div className="space-y-2 animate-fadeInDown">
                                            <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Specify Area Name</label>
                                            <div className="relative group">
                                                <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#22c55e] transition-colors" size={18} />
                                                <input 
                                                    name="customArea" 
                                                    type="text" 
                                                    value={locationData.customArea} 
                                                    onChange={handleLocationChange} 
                                                    className="w-full pl-12 pr-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all text-sm font-bold outline-none text-[#051F20] placeholder:text-gray-400" 
                                                    placeholder="Enter your local area..." 
                                                    required 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block ml-1">Street & House Details</label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-4 text-gray-400 group-focus-within:text-[#22c55e] transition-colors" size={18} />
                                            <textarea 
                                                name="street" 
                                                value={locationData.street} 
                                                onChange={handleLocationChange} 
                                                rows="2" 
                                                className="w-full pl-12 pr-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 transition-all text-sm font-medium outline-none resize-none text-[#051F20] placeholder:text-gray-400" 
                                                placeholder="House 12, Road 5, Block C..." 
                                                required 
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {potentialPoints > 0 && !errorMsg && (
                                    <div className="bg-[#22c55e]/10 rounded-xl p-4 flex items-center gap-3 border border-[#22c55e]/20 animate-fadeIn">
                                        <div className="bg-white p-2 rounded-lg shadow-sm animate-pulse"><Zap size={18} className="text-[#22c55e] fill-[#22c55e]" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-[#051F20]">Impact Points Preview</p>
                                            <p className="text-xs text-[#235347]">You will earn approximately <strong className="text-[#051F20]">{potentialPoints} EcoPoints</strong> upon submission.</p>
                                        </div>
                                    </div>
                                )}

                                {errorMsg && (
                                    <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3 border border-red-200 animate-fadeIn">
                                        <AlertCircle size={20} className="text-red-600 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-red-900">Submission Failed</p>
                                            <p className="text-xs text-red-700">{errorMsg}</p>
                                        </div>
                                    </div>
                                )}
                            
                                <button 
                                    type="submit" 
                                    disabled={loading || !isFormValid || isButtonSuccess} 
                                    className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm
                                        ${isButtonSuccess 
                                            ? 'bg-[#22c55e] text-[#051F20] scale-[1.02]' 
                                            : isFormValid 
                                                ? 'bg-[#051F20] text-white hover:bg-[#22c55e] hover:text-[#051F20] active:scale-95 cursor-pointer' 
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                        }`}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> Processing...</span>
                                    ) : isButtonSuccess ? (
                                        <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Data Transmitted</span>
                                    ) : (
                                        <>Submit Eco-Log <ArrowRight size={16} /></>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>

            {/* --- FOOTER --- */}
            <footer className="w-full bg-[#051F20] text-[#8EB69B] border-t border-white/10 py-10 px-6 lg:px-10 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                            <Leaf size={18} className="text-[#22c55e]" />
                            <span>EcoCycle Portal</span>
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
        </div>
    );
}