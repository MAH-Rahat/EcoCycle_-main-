import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    LogOut, Zap, Package, Clock, TrendingUp, Compass, Newspaper, 
    Calendar, Info, Github, Twitter, Mail, Phone, ShieldCheck, Leaf,
    LogIn, X, Heart, User, ChevronDown, Settings, Bell, Menu
} from 'lucide-react'; 

import backgroundRecycle from '../assets/background-recycle.jpg'; 
import heroPic1 from '../assets/hero-pic-1.jpg'; 
import heroPic2 from '../assets/hero-pic-2.jpg'; 

const API_BASE_URL = 'https://ecocycle-p.onrender.com';

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
        <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1 group-hover:text-[#4CAF50] transition-colors">{title}</h3>
        <p className="text-xs md:text-sm text-gray-600 line-clamp-2 leading-relaxed">{snippet}</p>
    </div>
);

const StatDisplay = ({ icon: Icon, value, unit }) => (
    <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full border border-gray-300 shadow-sm">
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
        <span className="font-bold text-yellow-700 text-sm md:text-lg">{value} <span className="text-[10px] md:text-sm font-medium">{unit}</span></span>
    </div>
);

const NavLink = ({ to, label, navigate, mobile }) => (
    <a 
        onClick={() => navigate(to)} 
        className={`${mobile ? 'block py-3 border-b border-gray-100 text-lg' : 'text-sm'} text-gray-600 hover:text-[#4CAF50] transition font-medium cursor-pointer`}
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [campaigns, setCampaigns] = useState([]); 
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [userStats, setUserStats] = useState({ points: 0, itemsLogged: 0 }); 

    const StatCard = ({ icon: Icon, title, value, unit, colorClass, shadowClass }) => (
        <div className={`bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-between transform transition-all duration-200 hover:scale-[1.02]`}>
            <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-lg ${shadowClass} bg-opacity-20`}>
                    <Icon className={`h-6 w-6 ${colorClass}`} />
                </div>
                <p className="text-xs text-gray-500 uppercase font-black tracking-widest">{title}</p>
            </div>
            <h3 className="text-3xl font-black text-gray-800 leading-none">
                {value} <span className="text-sm font-medium text-gray-400">{unit}</span>
            </h3>
        </div>
    );
    
    const fetchUserStats = async (userId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/stats/${userId}`);
            setUserStats(res.data);
        } catch (error) {
            setUserStats({ points: 0, itemsLogged: 0 });
        }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/campaigns`);
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
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#4CAF50] font-black tracking-widest animate-pulse text-xs md:text-lg">INITIALIZING ECO-SYSTEM...</div>;
    }

    return (
        <div className="min-h-screen relative overflow-hidden font-sans flex flex-col bg-gray-50">
            {isLoggingOut && (
                <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#4CAF50] font-bold tracking-widest animate-pulse">SECURING SESSION...</p>
                </div>
            )}

            <div 
                className="absolute inset-0 bg-cover bg-center z-0" 
                style={{ backgroundImage: `url(${backgroundRecycle})`, filter: 'blur(10px)', opacity: 0.1 }}
            />
            
            {/* Header */}
            <header className="bg-white/95 shadow-sm sticky top-0 z-40 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 md:h-20">
                    <div className="text-xl md:text-2xl font-black text-[#4CAF50] tracking-tighter flex items-center gap-2 italic cursor-pointer" onClick={() => navigate('/')}>
                        <Leaf className="h-6 w-6" /> EcoCycle
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex space-x-8 items-center">
                        <NavLink to="/home" label="Home" navigate={navigate} />
                        <button onClick={() => handleProtectedAction('/my-activity')} className="text-gray-600 text-sm hover:text-[#4CAF50] transition font-bold">My Activity</button>
                        <NavLink to="#" label="Community" navigate={navigate} />
                        
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <StatDisplay icon={Zap} value={userStats.points} unit="pts" /> 
                                <div className="relative" ref={dropdownRef}>
                                    <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-2 p-1 pr-3 rounded-full bg-gray-50 border border-gray-200">
                                        <div className="w-8 h-8 bg-[#4CAF50] rounded-full flex items-center justify-center text-white font-black text-sm uppercase">{user.name.charAt(0)}</div>
                                        <ChevronDown size={14} className="text-gray-400" />
                                    </button>
                                    {showProfileDropdown && (
                                        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-fadeIn">
                                             <div className="px-4 py-2 border-b border-gray-50 mb-2">
                                                <p className="text-xs font-black text-gray-800 truncate">{user.name}</p>
                                                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                                            </div>
                                            <button className="w-full flex items-center px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"><User className="mr-2 h-4 w-4"/> Profile</button>
                                            <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 mt-2 border-t border-gray-50 pt-2"><LogOut className="mr-2 h-4 w-4"/> Sign Out</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => navigate('/login')} className="bg-[#4CAF50] text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-[#388E3C] transition-all shadow-lg">Sign In</button>
                        )}
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <div className="md:hidden flex items-center gap-4">
                        {user && <StatDisplay icon={Zap} value={userStats.points} unit="pts" />}
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Slide-down Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 animate-fadeIn shadow-xl">
                        <NavLink mobile to="/home" label="Home" navigate={navigate} />
                        <button onClick={() => {setIsMobileMenuOpen(false); handleProtectedAction('/my-activity');}} className="w-full text-left py-3 border-b border-gray-100 text-lg text-gray-600 font-medium">My Activity</button>
                        <NavLink mobile to="#" label="Community" navigate={navigate} />
                        {user ? (
                            <button onClick={handleLogout} className="w-full text-left py-4 text-red-500 font-black flex items-center uppercase text-sm"><LogOut className="mr-2 h-5 w-5" /> Logout</button>
                        ) : (
                            <button onClick={() => navigate('/login')} className="w-full mt-4 bg-[#4CAF50] text-white py-4 rounded-xl font-black uppercase tracking-widest">Sign In</button>
                        )}
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto py-6 md:py-12 px-4 sm:px-6 lg:px-8 relative z-10 flex-grow w-full">
                {/* Hero Section */}
                <div className="mb-8 md:mb-12 p-6 md:p-12 bg-white rounded-[2rem] md:rounded-[3rem] shadow-xl border border-gray-100 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-center relative z-10">
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl md:text-6xl font-black text-gray-900 mb-4 leading-tight">
                                {user ? `Hi, ${user.name.split(' ')[0]}!` : "Protect the Planet"}
                            </h1>
                            <p className="text-base md:text-xl text-gray-500 mb-8 md:mb-10 font-medium max-w-lg">
                                {user ? "Ready to make a difference today? Track your waste and earn rewards." : "The modern way to manage recycling and restore our ecosystem."}
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                <button 
                                    onClick={() => handleProtectedAction('/log-waste')} 
                                    className="flex items-center justify-center space-x-2 bg-[#4CAF50] text-white font-black px-8 py-4 rounded-2xl hover:shadow-2xl hover:shadow-green-200 transition-all active:scale-95 text-sm md:text-base">
                                    <Package className="h-5 w-5"/>
                                    <span>Log New Waste</span>
                                </button>
                                <button 
                                    onClick={() => handleProtectedAction('/my-activity')}
                                    className="flex items-center justify-center space-x-2 border-2 border-gray-100 bg-white text-gray-700 font-black px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all text-sm md:text-base">
                                    <Clock className="h-5 w-5"/>
                                    <span>Pickup Request</span>
                                </button>
                            </div>
                        </div>

                        {/* Hidden on Mobile, shown on Large Screens */}
                        <div className="hidden lg:flex space-x-4 ml-10">
                            <div className="w-48 h-64 overflow-hidden rounded-[2.5rem] shadow-2xl border-8 border-white animate-shiftUp">
                                <img src={heroPic1} alt="Eco 1" className="w-full h-full object-cover" />
                            </div>
                            <div className="w-48 h-64 overflow-hidden rounded-[2.5rem] shadow-2xl border-8 border-white animate-shiftDown mt-12">
                                <img src={heroPic2} alt="Eco 2" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid - Responsive Columns */}
                <div className="mb-12">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                        <div className="h-1 w-8 bg-[#4CAF50]"></div> Your Impact
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-fadeIn">
                        <StatCard icon={TrendingUp} title="Items Logged" value={userStats.itemsLogged} unit="items" colorClass="text-indigo-600" shadowClass="bg-indigo-500" />
                        <StatCard icon={Zap} title="Eco Points" value={userStats.points} unit="pts" colorClass="text-yellow-600" shadowClass="bg-yellow-500" />
                        <StatCard icon={Compass} title="Current Tier" value="Silver" unit="Rank" colorClass="text-amber-600" shadowClass="bg-amber-500" />
                    </div>
                </div>

                {/* News Section */}
                <div>
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-gray-800">Eco-Intelligence</h2>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Global awareness reports</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {campaigns.length > 0 ? (
                            campaigns.map((post) => (
                                <ContentCard key={post._id} title={post.title} snippet={post.content} tag={post.category} date={new Date(post.createdAt).toLocaleDateString()} />
                            ))
                        ) : (
                            <div className="col-span-full py-16 text-center text-gray-300 font-black border-4 border-dashed border-gray-100 rounded-[2rem] text-sm uppercase">No intelligence data received.</div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal remains hidden unless triggered */}
            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><Heart className="text-[#4CAF50] fill-current" /></div>
                        <h3 className="text-xl font-black text-gray-800 mb-2">Login Required</h3>
                        <p className="text-gray-500 mb-8 text-sm">Please sign in to access tracking and request features.</p>
                        <button onClick={() => navigate('/login')} className="w-full bg-[#4CAF50] text-white font-bold py-4 rounded-xl mb-3 hover:bg-[#388E3C] transition-all">Go to Login</button>
                        <button onClick={() => setShowLoginModal(false)} className="text-gray-400 text-xs font-black uppercase hover:text-gray-600 tracking-widest">Close</button>
                    </div>
                </div>
            )}

            <footer className="bg-white border-t border-gray-100 py-12 md:py-20 mt-12">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-center md:text-left">
                    <div className="col-span-1 md:col-span-1">
                        <div className="text-2xl font-black text-[#4CAF50] italic mb-6">EcoCycle</div>
                        <p className="text-sm text-gray-400 leading-relaxed font-medium italic">Building a sustainable waste-to-resource management infrastructure.</p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-900">Platform</h4>
                        <ul className="text-sm space-y-2 text-gray-500 font-bold">
                            <li className="hover:text-[#4CAF50] cursor-pointer" onClick={() => navigate('/home')}>Dashboard</li>
                            <li className="hover:text-[#4CAF50] cursor-pointer">Community</li>
                            <li className="hover:text-[#4CAF50] cursor-pointer">Impact Map</li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-900">Support</h4>
                        <ul className="text-sm space-y-2 text-gray-500 font-bold">
                            <li>help@ecocycle.io</li>
                            <li>Documentation</li>
                        </ul>
                    </div>
                    <div className="bg-[#4CAF50]/5 p-8 rounded-[2rem] border border-[#4CAF50]/10">
                        <div className="text-3xl font-black text-[#4CAF50]">84%</div>
                        <p className="text-[10px] font-black text-[#4CAF50] uppercase mt-2">Local Cleaning Target</p>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-[#4CAF50] w-[84%]"></div>
                        </div>
                    </div>
                </div>
            </footer>

            <style jsx="true">{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
                @keyframes shiftUp { 0%, 100% { transform: translateY(10px); } 50% { transform: translateY(0px); } }
                @keyframes shiftDown { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(10px); } }
                .animate-shiftUp { animation: shiftUp 6s infinite ease-in-out; }
                .animate-shiftDown { animation: shiftDown 6s infinite ease-in-out; }
            `}</style>
        </div>
    );
}