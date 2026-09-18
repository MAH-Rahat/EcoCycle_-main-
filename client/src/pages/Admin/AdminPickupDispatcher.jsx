import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Truck, UserCheck, Calendar, MapPin, Package, Search, 
    RefreshCw, CheckCircle2, AlertTriangle, Leaf, LogOut, Menu, X, Shield, Clock
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminPickupDispatcher() {
    const navigate = useNavigate();
    const [pickups, setPickups] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPickup, setSelectedPickup] = useState(null);
    const [selectedCollectorId, setSelectedCollectorId] = useState('');
    const [dispatchNotes, setDispatchNotes] = useState('');
    const [showSuccess, setShowSuccess] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const adminInfo = JSON.parse(localStorage.getItem('userInfo')) || { name: 'Admin' };

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch scheduled pickups
            const pickupsRes = await axios.get(`${API_BASE_URL}/api/waste/admin/pickups`, { headers });
            const pickupsData = pickupsRes.data.data || pickupsRes.data || [];
            setPickups(Array.isArray(pickupsData) ? pickupsData : []);

            // Fetch available collectors (Users with role 'collector')
            const usersRes = await axios.get(`${API_BASE_URL}/api/users`, { headers }).catch(() => ({ data: [] }));
            const usersList = usersRes.data.data || usersRes.data.users || usersRes.data || [];
            const filteredCollectors = Array.isArray(usersList) ? usersList.filter(u => u.role === 'collector') : [];
            setCollectors(filteredCollectors);
        } catch (err) {
            console.error("Dispatcher Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!selectedPickup || !selectedCollectorId) return;

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Assign collector via waste route
            await axios.put(`${API_BASE_URL}/api/waste/admin/assign/${selectedPickup._id}`, {
                collectorId: selectedCollectorId,
                dispatchNotes
            }, { headers });

            // Synchronize with pickup route so it appears on collector dashboard
            await axios.put(`${API_BASE_URL}/api/pickup/assign/${selectedPickup._id}`, {
                collectorId: selectedCollectorId
            }, { headers }).catch(() => {});

            setShowSuccess('Collector assigned successfully! Task dispatched to collector dashboard.');
            setTimeout(() => setShowSuccess(''), 3500);
            setSelectedPickup(null);
            setSelectedCollectorId('');
            setDispatchNotes('');
            fetchData();
        } catch (err) {
            console.error("Assignment Error:", err);
            alert('Failed to assign collector.');
        }
    };

    const handleNavigate = (path) => {
        if (window.location.pathname === path) return;
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const filteredPickups = pickups.filter(p => {
        const citizenName = (p.citizenId?.name || p.citizen?.name || '').toLowerCase();
        const address = (p.pickupDetails?.address || p.address?.street || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return citizenName.includes(query) || address.includes(query);
    });

    return (
        <div className="min-h-screen bg-[#F4F9F5] flex flex-col font-sans text-[#051F20] selection:bg-[#22c55e]/30 overflow-x-hidden">
            
            {showSuccess && (
                <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] bg-[#051F20] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#22c55e]/30 animate-scaleIn">
                    <CheckCircle2 className="text-[#22c55e]" size={20} />
                    <span className="text-sm font-bold uppercase tracking-widest">{showSuccess}</span>
                </div>
            )}

            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    <div className="flex items-center gap-8 lg:gap-12">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/admin-panel')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle <span className="text-xs uppercase px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] rounded border border-[#22c55e]/30">Dispatch</span></span>
                        </div>
                        <nav className="hidden xl:flex items-center gap-6">
                            <button onClick={() => handleNavigate('/admin-panel')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Dashboard</button>
                            <button onClick={() => handleNavigate('/admin/waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Waste Logs</button>
                            <button onClick={() => handleNavigate('/admin/pickups')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer flex items-center gap-1"><Truck size={14} /> Pickup Dispatch</button>
                            <button onClick={() => handleNavigate('/admin/campaigns')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Campaigns</button>
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="text-sm font-semibold text-white">{adminInfo.name}</p>
                            <p className="text-xs text-[#22c55e]">Dispatch Controller</p>
                        </div>
                        <button onClick={handleLogout} className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                            <LogOut size={16} /> Sign Out
                        </button>
                        <button className="xl:hidden text-white hover:text-[#22c55e]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* MOBILE MENU DROPDOWN */}
            {isMobileMenuOpen && (
                <div className="xl:hidden fixed inset-0 z-[150] bg-[#051F20] pt-28 px-6 animate-fadeIn overflow-y-auto pb-12">
                    <button className="absolute top-8 right-6 text-white hover:text-[#22c55e]" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={32} />
                    </button>
                    <div className="flex flex-col gap-4">
                        <button onClick={() => { handleNavigate('/admin-panel'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Dashboard</button>
                        <button onClick={() => { handleNavigate('/admin/waste'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Waste Logistics</button>
                        <button onClick={() => { handleNavigate('/admin/pickups'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left flex items-center gap-2"><Truck size={18} /> Pickup Dispatch</button>
                        <button onClick={() => { handleNavigate('/admin/campaigns'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Campaigns</button>
                        <button onClick={() => { handleNavigate('/admin/rewards'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Rewards Engine</button>
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-10 pt-36 pb-24 space-y-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_25px_rgba(5,31,32,0.03)]">
                    <div>
                        <div className="inline-flex items-center gap-2 mb-1">
                            <Truck size={16} className="text-[#22c55e]" />
                            <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Logistics & Dispatch</p>
                        </div>
                        <h2 className="text-3xl font-extrabold text-[#051F20] tracking-tight">Citizen Pickup Requests</h2>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#22c55e]" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search citizen or address..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className="w-full pl-12 pr-6 py-3 bg-[#F4F9F5] border border-gray-200/80 rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-[#22c55e] transition-all text-[#051F20] shadow-sm" 
                            />
                        </div>
                        <button onClick={fetchData} className="p-3 bg-[#F4F9F5] border border-gray-200/80 rounded-2xl text-[#051F20] hover:bg-[#051F20] hover:text-white transition-all cursor-pointer shadow-sm" title="Refresh">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </header>

                <div className="bg-white rounded-3xl shadow-[0_4px_30px_rgba(5,31,32,0.03)] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F4F9F5] border-b border-gray-100 text-[11px] font-bold text-[#235347] uppercase tracking-wider">
                                    <th className="py-4 px-6">Citizen</th>
                                    <th className="py-4 px-6">Material & Weight</th>
                                    <th className="py-4 px-6">Pickup Address</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Assigned Collector</th>
                                    <th className="py-4 px-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {loading ? (
                                    <tr><td colSpan="6" className="py-20 text-center text-gray-400">Loading scheduled pickups...</td></tr>
                                ) : filteredPickups.length === 0 ? (
                                    <tr><td colSpan="6" className="py-20 text-center text-gray-400">No active pickup requests found.</td></tr>
                                ) : (
                                    filteredPickups.map((item) => {
                                        const collectorName = item.assignedCollector?.name || item.assignedCollectorId?.name;
                                        const isAssigned = !!collectorName || item.pickupStatus === 'Assigned';

                                        return (
                                            <tr key={item._id} className="hover:bg-[#F4F9F5]/40 transition-colors">
                                                <td className="py-4 px-6 font-bold text-[#051F20]">
                                                    {item.citizenId?.name || item.citizen?.name || 'Citizen'}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="font-bold">{item.weight} kg</span> ({item.material || item.wasteType || 'Recyclable'})
                                                </td>
                                                <td className="py-4 px-6 max-w-[200px] truncate text-xs text-[#235347]">
                                                    <MapPin size={13} className="inline mr-1 text-[#22c55e]" />
                                                    {item.pickupDetails?.address || item.address?.street || 'N/A'}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase border ${
                                                        isAssigned ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        item.pickupStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {isAssigned ? 'Assigned' : (item.pickupStatus || 'Requested')}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 font-semibold text-xs text-[#235347]">
                                                    {collectorName ? (
                                                        <span className="text-[#22c55e] font-bold">✓ {collectorName}</span>
                                                    ) : (
                                                        <span className="text-amber-600 font-semibold italic">Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <button 
                                                        onClick={() => setSelectedPickup(item)} 
                                                        className="px-4 py-2 bg-[#051F20] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#22c55e] hover:text-[#051F20] transition-all cursor-pointer active:scale-95 shadow-sm"
                                                    >
                                                        {collectorName ? 'Re-Assign' : 'Assign Collector'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ASSIGN COLLECTOR MODAL */}
            {selectedPickup && (
                <div className="fixed inset-0 z-[150] bg-[#051F20]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-gray-100">
                        <h3 className="text-xl font-bold text-[#051F20] mb-2">Assign Waste Collector</h3>
                        <p className="text-xs text-[#235347] mb-6">
                            Dispatching collector for <span className="font-bold">{selectedPickup.weight} kg</span> of <span className="font-bold uppercase">{selectedPickup.material || selectedPickup.wasteType}</span>.
                        </p>

                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#235347] uppercase block mb-1.5">Select Collector ({collectors.length} Available)</label>
                                <select 
                                    required
                                    value={selectedCollectorId} 
                                    onChange={(e) => setSelectedCollectorId(e.target.value)}
                                    className="w-full p-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#22c55e] text-[#051F20]"
                                >
                                    <option value="">-- Choose Available Collector --</option>
                                    {collectors.map(c => (
                                        <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#235347] uppercase block mb-1.5">Dispatch Instructions / Notes</label>
                                <textarea 
                                    value={dispatchNotes} 
                                    onChange={(e) => setDispatchNotes(e.target.value)} 
                                    placeholder="Optional instructions for collector..." 
                                    rows={3}
                                    className="w-full p-3 bg-[#F4F9F5] border border-gray-200 rounded-xl text-xs outline-none focus:border-[#22c55e] text-[#051F20]"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-[#22c55e] text-[#051F20] py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-[#051F20] hover:text-white transition-all">Confirm Dispatch</button>
                                <button type="button" onClick={() => setSelectedPickup(null)} className="flex-1 bg-[#F4F9F5] text-[#235347] py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}