import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';
import { 
    LogOut, Zap, Leaf, X, ChevronDown, Menu, Globe, 
    UserCircle, ArrowRight, CheckCircle2, Quote, Play,
    Activity, ShieldCheck, Github, Mail, Megaphone, Bell,
    Recycle, Truck, Award, Sparkles, Target, Cpu, MessageSquare, Send, Bot, User
} from 'lucide-react'; 

import heroPic1 from '../assets/hero-pic-1.jpg'; 
import heroPic2 from '../assets/hero-pic-2.jpg'; 
import heroPic3 from '../assets/hero-pic-3.jpg'; 
import heroPic4 from '../assets/hero-pic-4.jpg'; 
import backgroundRecycle from '../assets/background-recycle.jpg'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [campaigns, setCampaigns] = useState([]); 
    const [userStats, setUserStats] = useState({ points: 0, itemsLogged: 0 });
    const [lang, setLang] = useState('en'); // Language State: 'en' or 'bn'
    const dropdownRef = useRef(null);

    // AI Assistant Widget States
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [aiMessages, setAiMessages] = useState([
        { sender: 'ai', text: 'Hello! I am EcoCycle AI. Ask me anything about waste sorting, recycling, or eco-points!' }
    ]);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const isAdmin = user?.role === 'admin';

    // HERO IMAGE SLIDER SETUP
    const heroImages = [heroPic1, heroPic2, heroPic3, heroPic4];
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-swap images every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
        }, 5000); 
        return () => clearInterval(interval);
    }, [heroImages.length]);

    // INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
    useEffect(() => {
        if (loading) return; 

        const observerOptions = {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px"
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); 
                }
            });
        }, observerOptions);

        const elements = document.querySelectorAll('.reveal-on-scroll');
        elements.forEach(el => observer.observe(el));

        return () => elements.forEach(el => observer.unobserve(el));
    }, [loading, campaigns]); 

    useEffect(() => {
        const userInfoString = localStorage.getItem('userInfo');
        if (userInfoString) {
            try {
                const loggedUser = JSON.parse(userInfoString);
                if (loggedUser?._id) {
                    setUser(loggedUser);
                    fetchUserStats(loggedUser._id);
                }
            } catch (e) { localStorage.removeItem('userInfo'); }
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

    const fetchUserStats = async (userId) => {
        try {
            const res = await api.get(`/api/waste/stats/${userId}`);
            setUserStats(res.data);
        } catch (error) { setUserStats({ points: 0, itemsLogged: 0 }); }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await api.get(`/api/campaigns`);
            setCampaigns(res.data.filter(p => p.status === 'Active' || !p.status));
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleLogout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            localStorage.removeItem('userInfo');
            setUser(null);
            navigate('/');
            setIsLoggingOut(false);
            setIsMobileMenuOpen(false);
        }, 800);
    };

    const toggleLanguage = () => {
        setLang(prev => prev === 'en' ? 'bn' : 'en');
    };

    const scrollToAbout = () => {
        const aboutEl = document.getElementById('about-section');
        if (aboutEl) {
            aboutEl.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // AI Chat Handler
    const handleAiSend = async (e) => {
        e.preventDefault();
        if (!aiInput.trim() || aiLoading) return;

        const userMessage = aiInput.trim();
        setAiInput('');
        setAiMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
        setAiLoading(true);

        try {
            const res = await axios.post(`${API_BASE_URL}/api/ai/query`, { message: userMessage });
            setAiMessages(prev => [...prev, { sender: 'ai', text: res.data.reply }]);
        } catch (err) {
            console.error(err);
            setAiMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error connecting to AI core.' }]);
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#051F20]">
            <div className="w-12 h-12 border-4 border-[#163832] border-t-[#22c55e] rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen font-sans flex flex-col overflow-x-hidden bg-[#F4F9F5] text-[#051F20] relative">
            
            {/* --- TOP SECTION (Navbar + Hero) --- */}
            <div className="relative bg-[#051F20] bg-cover bg-center" style={{ backgroundImage: `url(${backgroundRecycle})` }}>
                <div className="absolute inset-0 bg-[#051F20]/80 mix-blend-multiply transition-opacity duration-1000"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-[#051F20]/95 via-[#051F20]/60 to-[#051F20]"></div>
                
                {/* Navbar */}
                <header className="absolute top-0 left-0 right-0 z-[100] border-b border-white/10 bg-[#051F20]/30 backdrop-blur-md animate-fadeInDown">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigate('/')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle</span>
                        </div>

                        {/* PC NAVIGATION */}
                        <nav className="hidden lg:flex items-center gap-8">
                            <button onClick={() => navigate('/home')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all duration-300 active:scale-95 cursor-pointer">Home</button>
                            <button onClick={() => navigate('/log-waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all duration-300 active:scale-95 cursor-pointer">Log Waste</button>
                            <button onClick={() => user ? navigate('/my-activity') : navigate('/login')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all duration-300 active:scale-95 cursor-pointer">Pickup Request</button>
                            <button onClick={scrollToAbout} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all duration-300 active:scale-95 cursor-pointer">About</button>
                        </nav>

                        <div className="flex items-center gap-6">
                            {/* Language Toggle */}
                            <button onClick={toggleLanguage} className="flex items-center gap-2 text-white hover:text-[#22c55e] transition-colors duration-300 font-bold text-sm bg-white/5 px-3 py-1.5 rounded-full border border-white/10 active:scale-95 cursor-pointer">
                                <Globe size={16} />
                                <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
                            </button>

                            {user ? (
                                <div className="hidden lg:block relative" ref={dropdownRef}>
                                    <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300">
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-white group-hover:text-[#22c55e] transition-colors">{user.name.split(' ')[0]}</p>
                                            <p className="text-xs text-[#8EB69B] transition-colors">{userStats.points} Impact</p>
                                        </div>
                                        <div className="h-10 w-10 bg-[#163832] border border-[#235347] rounded-full flex items-center justify-center text-[#22c55e] font-bold group-hover:bg-[#22c55e] group-hover:text-[#051F20] transition-colors duration-300">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                    </button>

                                    {showProfileDropdown && (
                                        <div className="absolute right-0 mt-4 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#163832] hover:bg-[#F4F9F5] active:bg-[#e9f2eb] rounded-lg transition-all cursor-pointer"><UserCircle size={18} /> Profile</button>
                                            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-all cursor-pointer"><LogOut size={18} /> Sign Out</button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button onClick={() => navigate('/login')} className="hidden lg:block bg-[#22c55e] text-[#051F20] px-8 py-3.5 rounded-sm text-sm font-bold hover:bg-white hover:text-[#051F20] hover:shadow-[0_8px_25px_rgba(34,197,94,0.3)] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-300 cursor-pointer">
                                    Log In
                                </button>
                            )}
                            
                            <button className="lg:hidden text-white hover:text-[#22c55e] active:scale-90 transition-all duration-300 cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                                {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-40 pb-24 lg:pt-48 lg:pb-32 flex flex-col lg:grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="space-y-6 text-center lg:text-left">
                        <p className="text-[#8EB69B] text-sm font-bold tracking-[0.2em] uppercase animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                            {lang === 'en' ? 'Green Bangladesh' : 'সবুজ বাংলাদেশ'}
                        </p>
                        <h1 className={`font-bold text-white leading-[1.1] animate-fadeInUp ${lang === 'bn' ? 'text-4xl lg:text-5xl xl:text-6xl' : 'text-5xl lg:text-6xl xl:text-7xl'}`} style={{ animationDelay: '0.2s' }}>
                            {user ? (
                                <>{lang === 'en' ? 'Welcome back,' : 'স্বাগতম,'}<br /><span className="text-[#22c55e]">{user.name.split(' ')[0]}</span>.</>
                            ) : (
                                lang === 'en' ? 
                                <>Protecting The Beauty Of <br/> <span className="text-white">Bengal</span></> : 
                                <>বাংলার সৌন্দর্য <br/> <span className="text-white">রক্ষা করুন</span></>
                            )}
                        </h1>
                        <p className="text-[#8EB69B] text-lg leading-relaxed max-w-lg mx-auto lg:mx-0 font-light animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                            {lang === 'en' 
                                ? 'Professionally optimizing interdependent eco-actions. We unite communities across Bangladesh to log waste and build a sustainable future.' 
                                : 'পেশাদারিত্বের সাথে ইকো-অ্যাকশন অপ্টিমাইজ করুন। আমরা বাংলাদেশের সব সম্প্রদায়কে একত্রিত করে বর্জ্য ব্যবস্থাপনা ও একটি টেকসই ভবিষ্যৎ গড়তে কাজ করছি।'}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                            <button onClick={() => navigate('/log-waste')} className="group bg-[#22c55e] text-[#051F20] px-8 py-4 rounded-sm font-bold hover:bg-white hover:shadow-[0_8px_30px_rgba(34,197,94,0.4)] hover:-translate-y-1 active:scale-95 active:translate-y-0 transition-all duration-300 flex items-center gap-2 cursor-pointer">
                                {lang === 'en' ? 'Log Waste' : 'বর্জ্য জমা দিন'} <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button onClick={scrollToAbout} className="bg-transparent text-white border border-white/30 px-8 py-4 rounded-sm font-bold hover:bg-white hover:text-[#051F20] hover:-translate-y-1 active:scale-95 active:translate-y-0 transition-all duration-300 cursor-pointer">
                                {lang === 'en' ? 'Learn More' : 'আরও জানুন'}
                            </button>
                        </div>
                    </div>

                    {/* DYNAMIC HERO SLIDER */}
                    <div className="relative w-full h-[400px] lg:h-[500px] rounded-tl-[100px] rounded-br-[100px] border-b-8 border-l-8 border-[#22c55e] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden bg-[#0B2B26] group animate-scaleIn" style={{ animationDelay: '0.3s' }}>
                        {heroImages.map((img, index) => (
                            <img 
                                key={index}
                                src={img} 
                                className={`absolute top-0 left-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                                    index === currentImageIndex ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'
                                }`} 
                                alt={`Hero Slide ${index + 1}`} 
                            />
                        ))}
                        <div className="absolute inset-0 z-15 shadow-[inset_0_0_40px_rgba(5,31,32,0.6)] pointer-events-none"></div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                            {heroImages.map((_, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => setCurrentImageIndex(index)}
                                    className={`h-2.5 rounded-full transition-all duration-300 active:scale-75 cursor-pointer ${index === currentImageIndex ? 'bg-[#22c55e] w-8' : 'bg-white/50 w-2.5 hover:bg-white'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ADMIN NOTICE BOARD / ANNOUNCEMENTS SECTION --- */}
            {campaigns.length > 0 && (
                <div className="bg-[#051F20] border-y border-white/10 py-6 px-6 lg:px-10 relative z-20">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex items-center gap-2 bg-[#22c55e] text-[#051F20] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider shrink-0 shadow-sm">
                            <Bell size={16} className="animate-bounce" /> Announcement Notice
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex gap-8 animate-marquee text-white text-sm font-medium items-center">
                                {campaigns.map((notice) => (
                                    <div key={notice._id} className="flex items-center gap-3 shrink-0">
                                        <span className="text-[#22c55e] font-bold">[{notice.category}]</span>
                                        <span>{notice.title}:</span>
                                        <span className="text-[#8EB69B] text-xs">{notice.content.substring(0, 80)}...</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-grow w-full">
                
                {/* --- NOTICE CARDS GRID (Admin News & Announcements) --- */}
                {campaigns.length > 0 && (
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
                        <div className="flex justify-between items-end mb-10">
                            <div>
                                <div className="inline-flex items-center gap-2 mb-2">
                                    <Megaphone size={16} className="text-[#22c55e]" />
                                    <p className="text-sm font-bold text-[#235347] uppercase tracking-wider">Official Bulletins</p>
                                </div>
                                <h2 className="text-3xl font-bold text-[#051F20]">Latest Admin Notices & News</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {campaigns.map((post, i) => (
                                <div key={post._id} className="reveal-on-scroll bg-white rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(5,31,32,0.03)] border border-gray-100 hover:shadow-[0_15px_40px_rgba(5,31,32,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between" style={{ transitionDelay: `${i * 0.15}s` }}>
                                    {post.imageUrl && (
                                        <div className="h-48 overflow-hidden bg-gray-100">
                                            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                        </div>
                                    )}
                                    <div className="p-8 flex flex-col flex-grow">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="bg-[#22c55e]/10 text-[#22c55e] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#22c55e]/20">
                                                {post.category || 'News'}
                                            </span>
                                            <span className="text-xs font-semibold text-[#8EB69B]">{new Date(post.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-[#051F20] mb-3">{post.title}</h3>
                                        <p className="text-[#235347] text-sm leading-relaxed mb-6 flex-grow">{post.content}</p>
                                        <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-xs font-bold text-[#8EB69B]">
                                            <span>Posted by: Admin</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- PROFESSIONAL EXPANDED ABOUT SECTION (id="about-section") --- */}
                <div id="about-section" className="max-w-7xl mx-auto px-6 lg:px-10 py-28 lg:py-36 relative scroll-mt-20">
                    <Leaf className="absolute top-10 right-10 text-[#22c55e]/10 h-64 w-64 -rotate-45 pointer-events-none" />

                    <div className="text-center max-w-3xl mx-auto mb-20 reveal-on-scroll">
                        <div className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] text-xs font-bold uppercase tracking-wider border border-[#22c55e]/20">
                            <Sparkles size={14} /> National Impact & Vision
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#051F20] tracking-tight mb-6">
                            {lang === 'en' ? 'Transforming Waste Management Across Bangladesh' : 'বাংলাদেশে বর্জ্য ব্যবস্থাপনার বিপ্লব'}
                        </h2>
                        <p className="text-[#235347] text-base lg:text-lg leading-relaxed">
                            {lang === 'en' 
                                ? 'EcoCycle is a next-generation environmental logistics platform engineered to tackle urban waste challenges in Dhaka and beyond. By bridging the gap between conscious citizens, municipal collection networks, and sustainable recycling centers, we are pioneering a cleaner, greener future for Bangladesh.'
                                : 'ইকোসাইকেল একটি আধুনিক পরিবেশগত লজিস্টিকস প্ল্যাটফর্ম যা ঢাকা ও এর বাইরে নগর বর্জ্য ব্যবস্থাপনার চ্যালেঞ্জ মোকাবেলায় তৈরি করা হয়েছে। সচেতন নাগরিক এবং টেকসই পুনর্ব্যবহার কেন্দ্রগুলোর মধ্যে সেতুবন্ধন তৈরি করে আমরা একটি পরিচ্ছন্ন ও সবুজ বাংলাদেশের নেতৃত্ব দিচ্ছি।'}
                        </p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                        {[
                            {
                                icon: Recycle,
                                titleEn: 'Smart Waste Logging',
                                titleBn: 'স্মার্ট বর্জ্য লগিং',
                                descEn: 'Easily categorize and log recyclable materials including plastic, paper, metal, glass, and electronic waste with instant impact point calculation.',
                                descBn: 'প্লাস্টিক, কাগজ, ধাতু এবং ইলেকট্রনিক বর্জ্য সহজেই ক্যাটাগরি অনুযায়ী লগ করুন এবং তাৎক্ষণিকভাবে ইমপ্যাক্ট পয়েন্ট অর্জন করুন।'
                            },
                            {
                                icon: Truck,
                                titleEn: 'Verified Pickup Logistics',
                                titleBn: 'যাচাইকৃত পিকআপ লজিস্টিকস',
                                descEn: 'Schedule seamless collection pickups with verified local collectors, ensuring your recyclables reach authorized processing plants safely.',
                                descBn: 'যাচাইকৃত লোকাল কালেকটরদের সাথে পিকআপ শিডিউল করুন, যা আপনার বর্জ্য নিরাপদ প্রক্রিয়াজাতকরণ কেন্দ্রে পৌঁছে দেয়।'
                            },
                            {
                                icon: Award,
                                titleEn: 'Gamified Eco-Rewards',
                                titleBn: 'ইকো-রিওয়ার্ড সিস্টেম',
                                descEn: 'Earn ecological reward points for every successful recycling contribution, empowering active participation in community sustainability.',
                                descBn: 'প্রতিটি সফল পুনর্ব্যবহার অবদানের জন্য পরিবেশগত রিওয়ার্ড পয়েন্ট অর্জন করুন এবং কমিউনিটি কার্যক্রমে অংশ নিন।'
                            }
                        ].map((feat, idx) => (
                            <div key={idx} className="reveal-on-scroll bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_30px_rgba(5,31,32,0.03)] hover:shadow-[0_15px_40px_rgba(5,31,32,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between" style={{ transitionDelay: `${idx * 0.15}s` }}>
                                <div>
                                    <div className="h-16 w-16 bg-[#F4F9F5] rounded-2xl flex items-center justify-center text-[#22c55e] mb-6 border border-[#22c55e]/20 shadow-sm">
                                        <feat.icon size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#051F20] mb-3">
                                        {lang === 'en' ? feat.titleEn : feat.titleBn}
                                    </h3>
                                    <p className="text-sm text-[#235347] leading-relaxed">
                                        {lang === 'en' ? feat.descEn : feat.descBn}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mission Banner Card */}
                    <div className="reveal-on-scroll bg-[#051F20] rounded-3xl p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-10 border border-white/10">
                        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#22c55e]/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="space-y-4 max-w-2xl relative z-10">
                            <div className="inline-flex items-center gap-2 text-[#22c55e] text-xs font-bold uppercase tracking-wider bg-white/5 px-3.5 py-1.5 rounded-full border border-white/10">
                                <Target size={14} /> National Vision 2030
                            </div>
                            <h3 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                                {lang === 'en' ? 'Building a Zero-Waste Urban Ecosystem in Bangladesh' : 'বাংলাদেশে জিরো-ওয়েস্ট শহুরে পরিবেশ তৈরি'}
                            </h3>
                            <p className="text-[#8EB69B] text-sm lg:text-base leading-relaxed font-light">
                                {lang === 'en' 
                                    ? 'Our mission is to divert thousands of tons of reusable materials from landfills, reduce greenhouse gas emissions, and foster a culture of civic environmental responsibility across all districts.'
                                    : 'আমাদের লক্ষ্য হলো হাজার হাজার টন পুনর্ব্যবহারযোগ্য বর্জ্য ল্যান্ডফিল থেকে রক্ষা করা, গ্রীনহাউস গ্যাস নির্গমন কমানো এবং দেশব্যাপী নাগরিক পরিবেশগত দায়িত্ববোধ গড়ে তোলা।'}
                            </p>
                        </div>
                        <button onClick={() => navigate('/log-waste')} className="relative z-10 bg-[#22c55e] text-[#051F20] px-8 py-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider hover:bg-white transition-all shadow-lg active:scale-95 shrink-0 cursor-pointer">
                            {lang === 'en' ? 'Get Started Today' : 'আজই শুরু করুন'}
                        </button>
                    </div>
                </div>

                {/* --- QUOTES SECTION --- */}
                <div className="bg-[#0B2B26] pt-24 pb-24 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#163832] rounded-full blur-[100px] opacity-50 pointer-events-none"></div>
                    
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
                        <div className="text-center mb-16 reveal-on-scroll">
                            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                                {lang === 'en' ? 'Voices for the Earth' : 'পৃথিবীর জন্য কণ্ঠস্বর'}
                            </h2>
                            <p className="text-[#8EB69B]">
                                {lang === 'en' ? 'Inspiring thoughts from those who champion our planet.' : 'যারা আমাদের এই গ্রহকে রক্ষা করেন তাদের অনুপ্রেরণামূলক চিন্তাভাবনা।'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { 
                                    text: lang === 'en' ? "The greatest threat to our planet is the belief that someone else will save it." : "আমাদের গ্রহের জন্য সবচেয়ে বড় হুমকি হলো এই বিশ্বাস যে অন্য কেউ এসে একে রক্ষা করবে।", 
                                    author: lang === 'en' ? "Robert Swan" : "রবার্ট সোয়ান", 
                                    role: lang === 'en' ? "Explorer" : "অন্বেষক" 
                                },
                                { 
                                    text: lang === 'en' ? "What you do makes a difference, and you have to decide what kind of difference you want to make." : "আপনি যা করেন তা প্রভাব ফেলে, আর আপনাকে সিদ্ধান্ত নিতে হবে আপনি কেমন প্রভাব ফেলতে চান।", 
                                    author: lang === 'en' ? "Jane Goodall" : "জেন গুডল", 
                                    role: lang === 'en' ? "Primatologist" : "প্রাইমেটোলজিস্ট" 
                                },
                                { 
                                    text: lang === 'en' ? "Environment is no one's property to destroy; it's everyone's responsibility to protect." : "পরিবেশ কারও ধ্বংস করার সম্পত্তি নয়; এটি রক্ষা করা সবার দায়িত্ব।", 
                                    author: lang === 'en' ? "Mohith Agadi" : "মোহিত আগাদি", 
                                    role: lang === 'en' ? "Author" : "লেখক" 
                                }
                            ].map((quote, i) => (
                                <div key={i} className="reveal-on-scroll bg-[#051F20] p-8 rounded-xl border border-white/5 relative group hover:bg-[#06292b] hover:border-[#22c55e]/30 hover:-translate-y-2 active:scale-[0.98] hover:shadow-[0_15px_30px_rgba(0,0,0,0.3)] transition-all duration-500 cursor-pointer" style={{ transitionDelay: `${i * 0.15}s` }}>
                                    <Quote className="text-[#22c55e]/20 w-12 h-12 absolute top-6 right-6 group-hover:text-[#22c55e]/40 group-hover:scale-110 transition-all duration-500" />
                                    <p className="text-white text-lg font-medium leading-relaxed mb-8 relative z-10 italic">"{quote.text}"</p>
                                    <div className="border-t border-white/10 pt-6">
                                        <p className="text-[#22c55e] font-bold text-lg">{quote.author}</p>
                                        <p className="text-[#8EB69B] text-sm">{quote.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* MOBILE MENU */}
            <div className={`lg:hidden fixed inset-0 z-[150] bg-[#051F20] pt-24 px-6 transition-transform duration-500 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col gap-2 h-full">
                    <button className="absolute top-8 right-6 text-white hover:text-[#22c55e] active:scale-90 transition-all duration-300 cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={32} />
                    </button>
                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-[#0B2B26] border border-white/5 rounded-xl mb-8">
                            <div className="h-14 w-14 bg-[#22c55e] rounded-full flex items-center justify-center text-[#051F20] font-bold text-xl">{user.name.charAt(0).toUpperCase()}</div>
                            <div>
                                <p className="text-lg font-bold text-white">{user.name}</p>
                                <p className="text-sm text-[#8EB69B]">{user.email}</p>
                            </div>
                        </div>
                    )}
                    <button onClick={() => {navigate('/home'); setIsMobileMenuOpen(false);}} className="text-2xl font-bold text-white hover:text-[#22c55e] transition-colors text-left py-4 border-b border-white/10 cursor-pointer">Home</button>
                    <button onClick={() => {navigate('/log-waste'); setIsMobileMenuOpen(false);}} className="text-2xl font-bold text-white hover:text-[#22c55e] transition-colors text-left py-4 border-b border-white/10 cursor-pointer">Log Waste</button>
                    <button onClick={() => {navigate('/my-activity'); setIsMobileMenuOpen(false);}} className="text-2xl font-bold text-white hover:text-[#22c55e] transition-colors text-left py-4 border-b border-white/10 cursor-pointer">Pickup Request</button>
                    <button onClick={() => {scrollToAbout(); setIsMobileMenuOpen(false);}} className="text-2xl font-bold text-white hover:text-[#22c55e] transition-colors text-left py-4 border-b border-white/10 cursor-pointer">About</button>
                    
                    <div className="mt-auto pb-12 pt-6">
                        {user ? (
                            <button onClick={handleLogout} className="w-full py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm text-base font-bold active:scale-95 transition-all duration-300 cursor-pointer">Sign Out</button>
                        ) : (
                            <button onClick={() => {navigate('/login'); setIsMobileMenuOpen(false);}} className="w-full py-4 bg-[#22c55e] text-[#051F20] rounded-sm text-base font-bold active:scale-95 transition-all duration-300 cursor-pointer">Log In</button>
                        )}
                    </div>
                </div>
            </div>

            {/* --- FLOATING AI ASSISTANT CHAT WIDGET --- */}
            <div className="fixed bottom-6 right-6 z-[999]">
                {!isAiOpen ? (
                    <button 
                        onClick={() => setIsAiOpen(true)}
                        className="bg-[#22c55e] text-[#051F20] p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center cursor-pointer font-bold border-2 border-white/20 animate-bounce"
                        title="Chat with EcoCycle AI"
                    >
                        <MessageSquare size={24} />
                    </button>
                ) : (
                    <div className="bg-white w-80 sm:w-96 rounded-3xl shadow-2xl border border-gray-100 flex flex-col h-[500px] overflow-hidden animate-scaleIn">
                        {/* Header */}
                        <div className="bg-[#051F20] p-4 text-white flex justify-between items-center border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Bot className="text-[#22c55e]" size={20} />
                                <span className="font-bold text-sm tracking-wide">EcoCycle AI Assistant</span>
                            </div>
                            <button onClick={() => setIsAiOpen(false)} className="text-gray-400 hover:text-white cursor-pointer transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Body */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F4F9F5]">
                            {aiMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed ${
                                        msg.sender === 'user' 
                                            ? 'bg-[#051F20] text-white rounded-br-none shadow-sm' 
                                            : 'bg-white text-[#051F20] border border-gray-200 shadow-sm rounded-bl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {aiLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-2xl text-xs text-gray-400 border border-gray-200 animate-pulse">
                                        EcoCycle AI is thinking...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Footer */}
                        <form onSubmit={handleAiSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Ask about sorting, recycling..." 
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                className="flex-1 bg-gray-50 px-4 py-3 rounded-xl text-xs font-medium outline-none border border-gray-200 focus:border-[#22c55e] text-[#051F20]"
                            />
                            <button type="submit" className="bg-[#22c55e] text-[#051F20] px-4 rounded-xl hover:bg-[#051F20] hover:text-white transition-all cursor-pointer flex items-center justify-center font-bold">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* --- DETAILED FOOTER --- */}
            <footer className="bg-[#051F20] pt-16 pb-8 border-t border-white/10 mt-auto">
                <div className="max-w-7xl mx-auto px-6 lg:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-16 lg:gap-12 mb-16 border-b border-white/10 pb-16">
                        
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-white font-bold text-2xl cursor-pointer hover:text-[#22c55e] active:scale-95 transition-all duration-300 w-fit" onClick={() => navigate('/')}>
                                <Leaf className="text-[#22c55e] h-6 w-6" /> EcoCycle
                            </div>
                            <ul className="space-y-3">
                                <li><button onClick={scrollToAbout} className="text-[#8EB69B] hover:text-[#22c55e] transition-colors text-sm font-semibold cursor-pointer">About Us</button></li>
                                <li><button onClick={() => navigate('/projects')} className="text-[#8EB69B] hover:text-[#22c55e] transition-colors text-sm font-semibold cursor-pointer">Programs</button></li>
                                <li><button onClick={() => navigate('/events')} className="text-[#8EB69B] hover:text-[#22c55e] transition-colors text-sm font-semibold cursor-pointer">Events</button></li>
                                <li><button onClick={() => navigate('/log-waste')} className="text-[#8EB69B] hover:text-[#22c55e] transition-colors text-sm font-semibold cursor-pointer">Log Waste</button></li>
                            </ul>
                            <div className="flex gap-4 pt-2">
                                <Github className="text-[#8EB69B] hover:text-white cursor-pointer hover:-translate-y-1 transition-all duration-300" size={20} />
                                <Mail className="text-[#8EB69B] hover:text-white cursor-pointer hover:-translate-y-1 transition-all duration-300" size={20} />
                            </div>
                        </div>

                        <div className="space-y-6 text-center md:text-left">
                            <h3 className="text-2xl font-bold text-white">Get Updates</h3>
                            <p className="text-sm text-[#8EB69B] font-light italic">Subscribe to our newsletter to receive updates and special announcements.</p>
                            <form className="space-y-3">
                                <input type="email" placeholder="*Email" className="w-full bg-transparent border border-[#8EB69B]/50 rounded-sm px-4 py-3 text-white placeholder:text-[#8EB69B]/70 focus:outline-none focus:border-[#22c55e] transition-colors text-sm cursor-text" required />
                                <div className="flex gap-3">
                                    <input type="text" placeholder="*First Name" className="w-full bg-transparent border border-[#8EB69B]/50 rounded-sm px-4 py-3 text-white placeholder:text-[#8EB69B]/70 focus:outline-none focus:border-[#22c55e] transition-colors text-sm cursor-text" required />
                                    <button type="submit" className="bg-[#f4f9f5] text-[#051F20] px-6 py-3 rounded-sm font-bold text-sm hover:bg-[#22c55e] hover:text-[#051F20] active:scale-95 transition-all duration-300 whitespace-nowrap cursor-pointer">SIGN UP</button>
                                </div>
                            </form>
                        </div>

                        <div className="space-y-6 md:text-right">
                            <h3 className="text-lg font-bold text-white hover:text-[#22c55e] cursor-pointer inline-flex items-center gap-2 transition-colors">Send Us A Message <ArrowRight size={18} /></h3>
                            <div className="text-sm text-[#8EB69B] space-y-4 font-medium flex flex-col md:items-end">
                                <p className="hover:text-white transition-colors cursor-pointer">+880 1234-567890</p>
                                <p className="md:text-right max-w-[200px]">Dhaka, Bangladesh</p>
                            </div>
                            <div className="flex md:justify-end pt-4">
                                <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center hover:border-[#22c55e] transition-colors duration-300 group cursor-pointer">
                                    <Leaf className="text-[#22c55e] opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-[#8EB69B]">
                        <p>© 2026 EcoCycle. All Rights Reserved.</p>
                        <div className="flex items-center gap-4">
                            <span className="cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
                            <span className="cursor-pointer hover:text-white transition-colors">Website By MAHR</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* --- CUSTOM ANIMATION & MARQUEE STYLES --- */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp { 
                    from { opacity: 0; transform: translateY(20px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
                @keyframes fadeInDown { 
                    from { opacity: 0; transform: translateY(-20px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
                @keyframes scaleIn { 
                    from { opacity: 0; transform: scale(0.95); } 
                    to { opacity: 1; transform: scale(1); } 
                }
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                
                .animate-fadeInUp { 
                    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
                    opacity: 0; 
                }
                .animate-fadeInDown { 
                    animation: fadeInDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
                    opacity: 0; 
                }
                .animate-scaleIn { 
                    animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
                    opacity: 0; 
                }
                .animate-marquee {
                    display: flex;
                    width: max-content;
                    animation: marquee 25s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }

                .reveal-on-scroll {
                    opacity: 0;
                    transform: translateY(30px);
                    transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .reveal-on-scroll.is-visible {
                    opacity: 1;
                    transform: translateY(0);
                }
            `}} />
        </div>
    );
}