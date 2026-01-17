import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Truck, Package, Clock, CheckCircle } from 'lucide-react';
import RequestPickup from './RequestPickup'; 

export default function MyActivity() {
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedWasteId, setSelectedWasteId] = useState(null);

    const userInfoString = localStorage.getItem('userInfo');
    const user = userInfoString ? JSON.parse(userInfoString) : null;

    const fetchActivity = async () => {
        if (!user || !user._id) return;
        try {
            const res = await axios.get(`http://localhost:5000/api/waste/user/${user._id}`);
            setActivities(res.data);
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

    const handleOpenPickup = (id) => {
        setSelectedWasteId(id);
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-lime-200 border-t-lime-600 rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-lime-700">Loading your history...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                    <button 
                        onClick={() => navigate('/home')} 
                        className="flex items-center text-gray-500 hover:text-black transition font-semibold"
                    >
                        <ArrowLeft className="mr-2 h-5 w-5" /> Back to Dashboard
                    </button>
                    {/* TOP BUTTON REMOVED */}
                </div>

                <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">My Waste Logs</h1>
                <p className="text-gray-500 mb-8 font-medium italic">You can schedule a pickup once an admin accepts your log.</p>

                <div id="pickup-section" className="space-y-4">
                    {activities.length > 0 ? (
                        activities.map((item) => (
                            <div 
                                key={item._id} 
                                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-all duration-300"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="bg-gray-100 p-4 rounded-2xl group-hover:bg-lime-50 transition-colors">
                                        <Package className="h-6 w-6 text-gray-400 group-hover:text-lime-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">{item.material}</h3>
                                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
                                            {item.weight} KG • {new Date(item.createdAt).toDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                        item.status === 'Accepted' ? 'bg-green-50 text-green-700 border-green-100' : 
                                        item.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    }`}>
                                        {item.status}
                                    </span>

                                    {/* --- BLOCKING LOGIC --- */}
                                    {item.status === 'Accepted' && (
                                        item.pickupDetails?.isRequested ? (
                                            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200">
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-xs font-bold uppercase">Requested</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleOpenPickup(item._id)}
                                                className="bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-lime-600 transition shadow-xl"
                                            >
                                                Schedule Truck
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-gray-200">
                            <Clock className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-bold text-lg">No history found.</p>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <RequestPickup 
                    wasteId={selectedWasteId} 
                    onClose={() => {
                        setShowModal(false);
                        fetchActivity(); // REFRESH DATA TO SHOW "REQUESTED"
                    }} 
                />
            )}
        </div>
    );
}