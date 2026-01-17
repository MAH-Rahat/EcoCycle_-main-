import React, { useState } from 'react';
import axios from 'axios';
import { Truck, Calendar, Clock, MapPin, X } from 'lucide-react';

export default function RequestPickup({ wasteId, onClose }) {
    const user = JSON.parse(localStorage.getItem('userInfo'));
    const [formData, setFormData] = useState({
        address: '',
        scheduledDate: '',
        timeSlot: 'Morning'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('http://localhost:5000/api/pickup/schedule', {
                ...formData,
                citizen: user._id,
                wasteItem: wasteId
            });
            alert("Pickup request successfully sent!");
            onClose(); 
        } catch (error) {
            console.error(error);
            alert("Failed to schedule pickup. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl relative animate-fadeInUp">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3 mb-6">
                    <div className="bg-lime-100 p-2 rounded-lg">
                        <Truck className="text-lime-600 h-6 w-6" />
                    </div>
                    Schedule Pickup
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Pickup Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            <input 
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none transition"
                                placeholder="Where should we collect it?"
                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Date</label>
                            <input 
                                type="date"
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none transition"
                                onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Preferred Slot</label>
                            <select 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-500 outline-none transition cursor-pointer"
                                onChange={(e) => setFormData({...formData, timeSlot: e.target.value})}
                            >
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="Evening">Evening</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full bg-lime-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-lime-200 transition-all 
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-lime-700 hover:scale-[1.02] active:scale-95'}`}
                    >
                        {loading ? 'Processing...' : 'Confirm Schedule'}
                    </button>
                </form>
            </div>
        </div>
    );
}