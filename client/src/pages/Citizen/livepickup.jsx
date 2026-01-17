import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, CheckCircle, Truck, Package, MapPin, ChevronLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- DUAL MODE URL CONFIG ---
// Automatically switches between Localhost for your PC and Render for Vercel
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const StatusStep = ({ icon: Icon, label, isActive, isCompleted }) => (
    <div className="flex flex-col items-center relative z-10 w-full">
        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            isCompleted ? 'bg-[#84CC16] border-[#84CC16] text-white' : 
            isActive ? 'bg-white border-[#84CC16] text-[#84CC16] shadow-lg shadow-lime-200' : 
            'bg-gray-100 border-gray-200 text-gray-400'
        }`}>
            {isCompleted ? <CheckCircle size={24} /> : <Icon size={24} />}
        </div>
        <p className={`mt-3 text-[10px] md:text-xs font-black uppercase tracking-widest ${isActive || isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
            {label}
        </p>
    </div>
);

const LivePickupStatus = () => {
    const navigate = useNavigate();
    const [pickupData, setPickupData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetching the current status using the Dynamic API URL
        axios.get(`${API_BASE_URL}/api/pickup/status`)
            .then(response => {
                setPickupData(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching pickup status:', error);
                setLoading(false);
            });
    }, []);

    const statusOrder = ['pending', 'assigned', 'in-progress', 'completed'];
    const currentStatus = pickupData?.status || 'pending';
    const currentIndex = statusOrder.indexOf(currentStatus);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-[#84CC16] border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-[#84CC16] font-black tracking-widest text-[10px] md:text-sm uppercase">Locating Collector...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-10">
            {/* --- RESPONSIVE HEADER --- */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 md:px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90">
                        <ChevronLeft className="text-gray-600" />
                    </button>
                    <h1 className="text-sm md:text-lg font-black text-gray-800 uppercase tracking-tighter italic">
                        Live <span className="text-[#84CC16]">Pickup</span> Status
                    </h1>
                    <div className="w-10"></div>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 mt-6 md:mt-12">
                {/* --- STATUS CARD --- */}
                <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden animate-fadeIn">
                    <div className="p-6 md:p-12">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <span className="text-[9px] md:text-[10px] font-black bg-lime-100 text-lime-700 px-3 py-1 rounded-full uppercase tracking-widest">
                                    ID: {pickupData?._id?.slice(-6).toUpperCase() || 'SEARCHING'}
                                </span>
                                <h2 className="text-2xl md:text-4xl font-black text-gray-900 mt-3 leading-tight tracking-tighter">
                                    {currentStatus === 'completed' ? "Mission Success!" : "Pickup Tracker"}
                                </h2>
                            </div>
                            <div className="bg-[#84CC16] p-3 md:p-4 rounded-2xl text-white shadow-lg shadow-lime-200">
                                <Truck size={28} className="md:w-8 md:h-8" />
                            </div>
                        </div>

                        {/* --- RESPONSIVE PROGRESS TRACKER --- */}
                        <div className="relative flex justify-between mb-12 px-2">
                            {/* Animated Connector Line */}
                            <div className="absolute top-5 md:top-7 left-0 w-full h-1 bg-gray-100 z-0">
                                <div 
                                    className="h-full bg-[#84CC16] transition-all duration-1000 ease-in-out" 
                                    style={{ width: `${(currentIndex / (statusOrder.length - 1)) * 100}%` }}
                                ></div>
                            </div>

                            <StatusStep icon={Clock} label="Pending" isActive={currentStatus === 'pending'} isCompleted={currentIndex > 0} />
                            <StatusStep icon={User} label="Assigned" isActive={currentStatus === 'assigned'} isCompleted={currentIndex > 1} />
                            <StatusStep icon={Package} label="Ongoing" isActive={currentStatus === 'in-progress'} isCompleted={currentIndex > 2} />
                            <StatusStep icon={CheckCircle} label="Done" isActive={currentStatus === 'completed'} isCompleted={currentIndex === 3} />
                        </div>

                        {/* --- DETAILS GRID --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-5 md:p-6 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-3 text-gray-400 mb-2">
                                    <MapPin size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Target Location</span>
                                </div>
                                <p className="text-xs md:text-sm font-bold text-gray-700">{pickupData?.address || 'Detecting address...'}</p>
                            </div>
                            <div className="bg-gray-50 p-5 md:p-6 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-3 text-gray-400 mb-2">
                                    <Clock size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Update Signal</span>
                                </div>
                                <p className="text-xs md:text-sm font-bold text-gray-700">
                                    {pickupData?.updatedAt ? new Date(pickupData.updatedAt).toLocaleTimeString() : 'Real-time'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 p-5 text-center">
                        <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em]">
                            EcoCycle Intelligence • Secure Logistics Terminal
                        </p>
                    </div>
                </div>

                <button 
                    onClick={() => navigate('/home')}
                    className="w-full mt-6 py-4 bg-white border-2 border-gray-200 text-gray-600 font-black rounded-2xl hover:bg-gray-50 transition-all uppercase text-[10px] tracking-[0.2em] active:scale-95 shadow-sm"
                >
                    Return to Mission Control
                </button>
            </main>
            
            <style jsx="true">{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default LivePickupStatus;