import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    LogOut, Zap, Package, Clock, TrendingUp, Compass, Newspaper, 
    Calendar, Info, Github, Twitter, Mail, Phone, ShieldCheck, Leaf,
    LogIn, X, Heart, User, ChevronDown, Settings, Bell
} from 'lucide-react'; 

import backgroundRecycle from '../assets/background-recycle.jpg'; 
import heroPic1 from '../assets/hero-pic-1.jpg'; 
import heroPic2 from '../assets/hero-pic-2.jpg'; 

const ContentCard = ({ title, snippet, tag, date }) => (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 cursor-pointer group h-full">
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                tag === 'Event' ? 'bg-orange-100 text-orange-700' : 
                tag === 'Recycling Fact' ? 'bg-green-100 text-green-700' : 
                'bg-blue-100 text-blue-700'
            }`}>
                {tag}
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">{date}</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-[#4CAF50] transition-colors">{title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{snippet}</p>
    </div>
);

const StatDisplay = ({ icon: Icon, value, unit }) => (
    <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full border border-gray-300 shadow-sm">
        <Icon className="h-5 w-5 text-yellow-600" />
        <span className="font-bold text-yellow-700 text-lg">{value} <span className="text-sm font-medium">{unit}</span></span>
    </div>
);

const NavLink = ({ to, label, navigate }) => (
    <a 
        onClick={() => navigate(to)} 
        className="text-gray-600 text-sm hover:text-[#4CAF50] transition font-medium cursor-pointer"
    >
        {label}
    </a>
);

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const [campaigns, setCampaigns] = useState([]); 
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [userStats, setUserStats] = useState({ points: 0, itemsLogged: 0 }); 

    const StatCard = ({ icon: Icon, title, value, unit, colorClass, shadowClass }) => (
        <div className={`bg-white p-5 rounded-xl shadow-lg border border-gray-200 flex flex-col justify-between transform transition-all duration-200 hover:shadow-xl hover:border-[#4CAF50]`}>
            <div className="flex items-center space-x-3 mb-2">
                <div className={`p-2 rounded-lg ${shadowClass} bg-opacity-10`}>
                    <Icon className={`h-6 w-6 ${colorClass}`} />
                </div>
                <p className="text-sm text-gray-500 uppercase font-semibold">{title}</p>
            </div>
            <h3 className="text-3xl font-extrabold text-gray-800 leading-none">
                {value} <span className="text-base font-medium text-gray-400">{unit}</span>
            </h3>
        </div>
    );
    
    const fetchUserStats = async (userId) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/waste/stats/${userId}`);
            setUserStats(res.data);
        } catch (error) {
            setUserStats({ points: 0, itemsLogged: 0 });
        }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/campaigns');
            setCampaigns(res.data);
        } catch (error) {
            console.error("Failed to fetch campaigns:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        if (userInfoString) {
            const loggedUser = JSON.parse(userInfoString);
            setUser(loggedUser);
            fetchUserStats(loggedUser._id); 
        }
        fetchCampaigns(); 

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleProtectedAction = (path) => {
        if (!user) {
            setShowLoginModal(true);
        } else {
            navigate(path);
        }
    };

    const handleLogout = () => {
        setIsLoggingOut(true);
        setShowProfileDropdown(false);
        
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            setUser(null);
            setIsLoggingOut(false);
            navigate('/');
        }, 1200);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#4CAF50] font-semibold tracking-widest animate-pulse text-lg">LOADING ECO-DASHBOARD...</div>;
    }

    return (
        <div className="min-h-screen relative overflow-hidden font-sans flex flex-col">
            {/* Logout Loading Overlay */}
            {isLoggingOut && (
                <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#4CAF50] font-bold tracking-widest animate-pulse">SECURING YOUR SESSION...</p>
                </div>
            )}

            <div 
                className="absolute inset-0 bg-cover bg-center z-0" 
                style={{ backgroundImage: `url(${backgroundRecycle})`, filter: 'blur(8px)', transform: 'scale(1.05)' }}
            />
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-0" />
            
            {/* Header */}
            <header className="bg-white/95 shadow-md sticky top-0 z-20 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 flex justify-between items-center h-16">
                    <div className="text-2xl font-black text-[#4CAF50] tracking-tighter flex items-center gap-2 italic cursor-pointer" onClick={() => navigate('/')}>
                        <Leaf className="h-6 w-6" /> EcoCycle
                    </div>
                    <nav className="flex space-x-6 items-center">
                        <NavLink to="/home" label="Home" navigate={navigate} />
                        <button onClick={() => handleProtectedAction('/my-activity')} className="text-gray-600 text-sm hover:text-[#4CAF50] transition font-medium">My Activity</button>
                        <NavLink to="#" label="Community" navigate={navigate} />
                        
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <StatDisplay icon={Zap} value={userStats.points} unit="pts" /> 
                                
                                {/* UPDATED USER BUTTON INTERFACE */}
                                <div className="relative" ref={dropdownRef}>
                                    <button 
                                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                        className="flex items-center gap-3 px-2 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm active:scale-95"
                                    >
                                        <div className="w-8 h-8 bg-[#4CAF50] rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="hidden sm:block text-left">
                                            <p className="text-xs font-black text-gray-800 leading-none">{user.name.split(' ')[0]}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Citizen</p>
                                        </div>
                                        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showProfileDropdown && (
                                        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-fadeIn z-50 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
                                                <p className="text-sm font-black text-gray-800">{user.name}</p>
                                                <p className="text-[10px] text-gray-500 truncate font-medium">{user.email}</p>
                                            </div>
                                            
                                            <div className="py-2">
                                                <button className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-[#4CAF50] transition-colors">
                                                    <User className="h-4 w-4" />
                                                    <span>My Profile</span>
                                                </button>
                                                <button className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-[#4CAF50] transition-colors">
                                                    <Bell className="h-4 w-4" />
                                                    <span>Notifications</span>
                                                </button>
                                                <button className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-[#4CAF50] transition-colors">
                                                    <Settings className="h-4 w-4" />
                                                    <span>Account Settings</span>
                                                </button>
                                            </div>

                                            <div className="pt-1 border-t border-gray-50">
                                                <button 
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center space-x-3 px-4 py-3 text-xs font-black text-red-500 hover:bg-red-50 transition-colors uppercase tracking-widest"
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                    <span>Sign Out</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => navigate('/login')}
                                className="flex items-center space-x-2 bg-[#4CAF50] text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-[#388E3C] transition-all shadow-lg shadow-green-100"
                            >
                                <LogIn className="h-4 w-4" />
                                <span>Sign In</span>
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-8 relative z-10 flex-grow w-full">
                
                {/* Welcome Header */}
                <div className="mb-10 p-8 bg-white/90 backdrop-blur-sm rounded-[2rem] shadow-2xl border-l-8 border-[#4CAF50] animate-fadeIn">
                    <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">
                                {user ? `Hi, ${user.name.split(' ')[0]}!` : "Welcome to EcoCycle"}
                            </h1>
                            <p className="text-xl text-gray-600 mb-8 font-medium">
                                {user ? "Ready to log your next contribution?" : "Join us in our mission to recycle and restore the planet."}
                            </p>
                            
                            <div className="flex space-x-4">
                                <button 
                                    onClick={() => handleProtectedAction('/log-waste')} 
                                    className="flex items-center justify-center space-x-2 bg-[#4CAF50] text-white font-black px-8 py-3.5 rounded-2xl 
                                                hover:bg-[#388E3C] transition-all duration-200 shadow-xl shadow-green-100 active:scale-95">
                                    <Package className="h-5 w-5"/>
                                    <span>Log Waste</span>
                                </button>

                                <button 
                                    onClick={() => handleProtectedAction('/my-activity')}
                                    className="flex items-center justify-center space-x-2 border-2 border-gray-200 bg-white text-gray-700 font-black px-8 py-3.5 rounded-2xl 
                                               hover:bg-gray-50 transition-all duration-200 active:scale-95">
                                    <Clock className="h-5 w-5"/>
                                    <span>Pickup Request</span>
                                </button>
                            </div>
                        </div>

                        <div className="hidden lg:flex space-x-6 ml-6 items-start">
                            <div className="w-56 h-40 overflow-hidden rounded-[2rem] shadow-2xl border-8 border-white animate-shiftUp">
                                <img src={heroPic1} alt="Recycling Art" className="w-full h-full object-cover" />
                            </div>
                            <div className="w-56 h-40 overflow-hidden rounded-[2rem] shadow-2xl border-8 border-white animate-shiftDown delay-100">
                                <img src={heroPic2} alt="Recycling Hand" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <h2 className="text-xl font-black text-gray-700 mb-6 uppercase tracking-widest border-b-2 border-gray-100 pb-3 flex items-center gap-2 font-sans">
                    <TrendingUp size={24} className="text-[#4CAF50]"/> Quick Stats
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn delay-200">
                    <StatCard icon={TrendingUp} title="Items Logged" value={userStats.itemsLogged} unit="items" colorClass="text-indigo-600" shadowClass="bg-indigo-100" />
                    <StatCard icon={Zap} title="Total Points" value={userStats.points} unit="pts" colorClass="text-yellow-600" shadowClass="bg-yellow-100" />
                    <StatCard icon={Compass} title="Next Goal" value="Silver" unit="Tier" colorClass="text-amber-600" shadowClass="bg-amber-100" />
                </div>

                <h2 className="text-xl font-black text-gray-700 mt-16 mb-6 uppercase tracking-widest border-b-2 border-gray-100 pb-3 flex items-center gap-2">
                    <Newspaper size={24} className="text-[#4CAF50]"/> Awareness & News
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn delay-300 mb-20">
                    {campaigns.length > 0 ? (
                        campaigns.map((post) => (
                            <ContentCard key={post._id} title={post.title} snippet={post.content} tag={post.category} date={new Date(post.createdAt).toLocaleDateString()} />
                        ))
                    ) : (
                        <div className="col-span-full py-20 bg-white/50 rounded-3xl border-4 border-dashed border-gray-200 text-center text-gray-400 font-black uppercase tracking-widest">No active intelligence reports.</div>
                    )}
                </div>
            </main>

            {/* --- Login Required Modal --- */}
            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl relative border border-green-50 overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                                <Heart className="text-[#4CAF50] fill-current" size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 mb-2 leading-tight">Join the Movement</h3>
                            <p className="text-gray-500 font-medium mb-8">Login to track your contributions and help us save the Earth together. 🌍✨</p>
                            
                            <button 
                                onClick={() => navigate('/login')}
                                className="w-full bg-[#4CAF50] text-white font-black py-4 rounded-2xl hover:bg-[#388E3C] transition-all shadow-xl shadow-green-100 active:scale-95 text-lg uppercase tracking-widest mb-4"
                            >
                                Login Now
                            </button>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Your eco-journey starts here</p>
                        </div>
                    </div>
                </div>
            )}

            <footer className="bg-white/90 border-t border-gray-200 relative z-20 backdrop-blur-md pt-16 pb-8 px-6 mt-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1 md:col-span-1 space-y-6 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 text-[#4CAF50] font-black text-2xl tracking-tighter uppercase italic">
                                <Leaf className="h-7 w-7" /> EcoCycle
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed font-medium">Empowering citizens to create a sustainable future. Every item logged is a step toward a cleaner planet.</p>
                        </div>
                        <div className="space-y-6 text-center md:text-left">
                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Resources</h4>
                            <ul className="space-y-3 text-sm text-gray-500 font-bold">
                                <li><a href="/home" className="hover:text-[#4CAF50]">Dashboard Home</a></li>
                                <li><a onClick={() => handleProtectedAction('/log-waste')} className="hover:text-[#4CAF50] cursor-pointer">Submit Material</a></li>
                                <li><a onClick={() => handleProtectedAction('/my-activity')} className="hover:text-[#4CAF50] cursor-pointer">Activity History</a></li>
                            </ul>
                        </div>
                        <div className="space-y-6 text-center md:text-left">
                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Support</h4>
                            <div className="space-y-4">
                                <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-gray-600 font-bold">
                                    <Mail className="h-4 w-4 text-[#4CAF50]" /> <span>help@ecocycle.io</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6 text-center md:text-left">
                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Local Impact</h4>
                            <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                                <div className="text-2xl font-black text-green-800 text-center">84% Cleaned</div>
                                <div className="w-full bg-green-200 h-2 rounded-full mt-3 overflow-hidden">
                                    <div className="bg-green-600 h-full w-[84%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100 text-center">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">© {new Date().getFullYear()} EcoCycle Ecosystem. Architected by MAHR.</p>
                    </div>
                </div>
            </footer>

            <style jsx="true">{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
                @keyframes shiftUp { 0%, 100% { transform: translateY(10px); } 50% { transform: translateY(0px); } }
                @keyframes shiftDown { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(10px); } }
                .animate-shiftUp { animation: shiftUp 6s infinite ease-in-out; }
                .animate-shiftDown { animation: shiftDown 6s infinite ease-in-out; }
            `}</style>
        </div>
    );
}