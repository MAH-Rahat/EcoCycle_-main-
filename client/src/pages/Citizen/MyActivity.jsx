import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Truck, Package, Clock, CheckCircle, Leaf, XCircle, Search, Filter } from 'lucide-react';
import RequestPickup from './RequestPickup'; 

// --- DUAL MODE URL CONFIG ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MyActivity() {
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedWasteId, setSelectedWasteId] = useState(null);

    const userInfoString = localStorage.getItem('userInfo');
    const user = userInfoString ? JSON.parse(userInfoString) : null;

    const fetchActivity = async () => {
        if (!user || !user._id) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/api/waste/user/${user._id}`);
            setActivities(res.data);
            setFilteredActivities(res.data);
        } catch (error) {
            console.error("History fetch failed:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            navigate('/login');
        } else {
            fetchActivity();
        }
    }, []);

    // --- ORGANIZED FILTERING & SEARCH LOGIC ---
    useEffect(() => {
        let result = activities;

        // Status Filter
        if (activeFilter === 'Schedule') {
            result = result.filter(item => item.status === 'Accepted');
        } else if (activeFilter !== 'All') {
            result = result.filter(item => item.status === activeFilter);
        }

        // Search Filter
        if (searchTerm) {
            result = result.filter(item => 
                item.material.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredActivities(result);
    }, [activeFilter, searchTerm, activities]);

    const handleOpenPickup = (id) => {
        setSelectedWasteId(id);
        setShowModal(true);
    };

    const FilterButton = ({ label, count }) => (
        <button 
            onClick={() => setActiveFilter(label)}
            className={`px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer active:scale-95
            ${activeFilter === label 
                ? 'bg-gray-900 text-white shadow-lg' 
                : 'bg-white text-gray-400 hover:bg-gray-100 border border-gray-100'}`}
        >
            {label}
            {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeFilter === label ? 'bg-lime-500 text-black' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
        </button>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-lime-200 border-t-lime-600 rounded-full animate-spin mb-4"></div>
                <p className="font-black text-xs uppercase tracking-[0.2em] text-lime-700">Analyzing History...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 md:px-8 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/home')} 
                        className="flex items-center text-gray-400 hover:text-black transition-all font-black text-[10px] md:text-xs uppercase tracking-widest cursor-pointer active:scale-90"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Back
                    </button>
                    <div className="flex items-center gap-2 italic cursor-pointer" onClick={() => navigate('/home')}>
                        <Leaf className="text-lime-600 h-5 w-5" />
                        <span className="text-lg font-black tracking-tighter text-gray-800 uppercase">EcoCycle</span>
                    </div>
                    <div className="w-10"></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8">
                {/* Search & Filter Section */}
                <div className="mb-8 space-y-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-3 tracking-tighter italic">Activity Terminal</h1>
                        <p className="text-sm md:text-base text-gray-400 font-medium">Search and organize your ecological assets.</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        {/* Search Bar */}
                        <div className="relative w-full md:w-2/3">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input 
                                type="text"
                                placeholder="Search by material (Plastic, Metal...)"
                                className="w-full bg-white border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-lime-500 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Status Tabs (Scrollable on mobile) */}
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                            <FilterButton label="All" count={activities.length} />
                            <FilterButton label="Pending" count={activities.filter(a => a.status === 'Pending').length} />
                            <FilterButton label="Schedule" count={activities.filter(a => a.status === 'Accepted').length} />
                            <FilterButton label="Rejected" count={activities.filter(a => a.status === 'Rejected').length} />
                        </div>
                    </div>
                </div>

                {/* Logs List */}
                <div className="space-y-4">
                    {filteredActivities.length > 0 ? (
                        filteredActivities.map((item) => (
                            <div 
                                key={item._id} 
                                className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-xl transition-all duration-300 animate-fadeIn cursor-default"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 md:p-5 rounded-2xl transition-colors ${
                                        item.status === 'Rejected' ? 'bg-red-50' : 'bg-gray-50 group-hover:bg-lime-50'
                                    }`}>
                                        <Package className={`h-6 w-6 md:h-8 md:w-8 ${
                                            item.status === 'Rejected' ? 'text-red-400' : 'text-gray-300 group-hover:text-lime-600'
                                        }`} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl md:text-2xl text-gray-800 tracking-tight italic">{item.material}</h3>
                                        <p className="text-[10px] md:text-xs text-gray-400 font-black uppercase tracking-widest mt-1">
                                            {item.weight} KG • {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                                    <span className={`px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] border ${
                                        item.status === 'Accepted' ? 'bg-green-50 text-green-700 border-green-100' : 
                                        item.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    }`}>
                                        {item.status}
                                    </span>

                                    {item.status === 'Accepted' && (
                                        item.pickupDetails?.isRequested ? (
                                            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-200 shadow-sm cursor-help">
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Requested</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleOpenPickup(item._id)}
                                                className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-lime-600 transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                                            >
                                                <Truck size={16} /> Schedule
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 animate-fadeIn">
                            <Clock className="h-12 w-12 text-gray-100 mx-auto mb-4" />
                            <p className="text-gray-400 font-black uppercase text-xs tracking-widest italic px-6 leading-relaxed">
                                No activity detected for "{searchTerm || activeFilter}"
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {showModal && (
                <RequestPickup 
                    wasteId={selectedWasteId} 
                    onClose={() => {
                        setShowModal(false);
                        fetchActivity(); 
                    }} 
                />
            )}

            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
}