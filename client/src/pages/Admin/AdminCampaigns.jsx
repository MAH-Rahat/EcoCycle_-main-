import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Megaphone, Send, Trash2, Edit3, 
    Search, History, Plus, EyeOff, Eye, Loader2, User, X, AlertCircle, 
    CheckCircle2, LayoutDashboard, Package, Gift, Users, Menu, Leaf, LogOut
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminCampaigns() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('create'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'News',
        imageUrl: ''
    });

    const adminInfo = JSON.parse(localStorage.getItem('userInfo')) || { name: 'Admin' };

    const fetchPosts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/campaigns`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(res.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        }
    };

    useEffect(() => { fetchPosts(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        const adminId = adminInfo?._id || "Unknown ID";

        try {
            const token = localStorage.getItem('token');
            if (isEditing) {
                await axios.put(`${API_BASE_URL}/api/campaigns/${isEditing}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_BASE_URL}/api/campaigns`, { 
                    ...formData, 
                    postedBy: 'Admin', // Forced to Admin as requested
                    adminId: adminId,
                    status: 'Active' 
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            resetForm();
            fetchPosts();
        } catch (error) {
            if (error.response?.status === 429) {
                setErrorMsg("Rate limit exceeded: You are posting too fast. Please wait a moment before trying again.");
            } else {
                setErrorMsg(error.response?.data?.message || "System Error: Could not save campaign.");
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleArchive = async (post) => {
        try {
            const token = localStorage.getItem('token');
            const newStatus = post.status === 'Archived' ? 'Active' : 'Archived';
            await axios.put(`${API_BASE_URL}/api/campaigns/${post._id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(posts.map(p => p._id === post._id ? { ...p, status: newStatus } : p));
        } catch (error) {
            setErrorMsg("Archive update failed.");
        }
    };

    const handleDelete = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/campaigns/${deleteId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(posts.filter(p => p._id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            setErrorMsg("Delete failed.");
        }
    };

    const handleEdit = (post) => {
        setIsEditing(post._id);
        setFormData({ title: post.title, content: post.content, category: post.category, imageUrl: post.imageUrl || '' });
        setView('create');
    };

    const resetForm = () => {
        setIsEditing(null);
        setFormData({ title: '', content: '', category: 'News', imageUrl: '' });
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

    const filteredPosts = posts.filter(p => 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.postedBy && p.postedBy.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[#F4F9F5] font-sans text-[#051F20] flex flex-col overflow-x-hidden selection:bg-[#22c55e]/30">
            
            {/* --- DEEP ECO NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-[#051F20] border-b border-white/10 shadow-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-24 flex justify-between items-center">
                    
                    <div className="flex items-center gap-8 lg:gap-12">
                        <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform duration-300" onClick={() => handleNavigate('/admin-panel')}>
                            <Leaf className="text-[#22c55e] h-8 w-8 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="text-2xl font-bold tracking-wide text-white">EcoCycle <span className="text-xs uppercase px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] rounded border border-[#22c55e]/30">Admin</span></span>
                        </div>

                        {/* NAVBAR LINKS */}
                        <nav className="hidden xl:flex items-center gap-6">
                            <button onClick={() => handleNavigate('/admin-panel')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Dashboard</button>
                            <button onClick={() => handleNavigate('/admin/waste')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Waste Logs</button>
                            <button onClick={() => handleNavigate('/admin/campaigns')} className="text-sm font-semibold text-white hover:text-[#22c55e] transition-all cursor-pointer">Campaigns</button>
                            <button onClick={() => handleNavigate('/admin/rewards')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Rewards</button>
                            <button onClick={() => handleNavigate('/admin/analytics')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Intelligence</button>
                            <button onClick={() => handleNavigate('/admin/users')} className="text-sm font-semibold text-[#8EB69B] hover:text-[#22c55e] transition-all cursor-pointer">Users</button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="text-sm font-semibold text-white">{adminInfo.name}</p>
                            <p className="text-xs text-[#22c55e]">System Administrator</p>
                        </div>

                        <button 
                            onClick={handleLogout}
                            className="hidden lg:flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                        
                        <button className="xl:hidden text-white hover:text-[#22c55e] active:scale-90 transition-all cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
                        <button onClick={() => { handleNavigate('/admin/campaigns'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-3 border-b border-white/10 text-left">Campaigns</button>
                        <button onClick={() => { handleNavigate('/admin/rewards'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Rewards Engine</button>
                        <button onClick={() => { handleNavigate('/admin/analytics'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">Intelligence</button>
                        <button onClick={() => { handleNavigate('/admin/users'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#8EB69B] py-3 border-b border-white/10 text-left">User Nodes</button>
                        <button onClick={handleLogout} className="mt-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold">Sign Out</button>
                    </div>
                </div>
            )}

            <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-10 pt-36 pb-24 space-y-8">
                
                {/* --- HEADER CONTEXT CARD --- */}
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(5,31,32,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fadeInUp opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div>
                        <div className="inline-flex items-center gap-2 mb-2">
                            <Leaf size={16} className="text-[#22c55e]" />
                            <p className="text-xs font-bold text-[#235347] uppercase tracking-wider">Awareness Terminal</p>
                        </div>
                        <h1 className="text-3xl font-bold text-[#051F20] tracking-tight">
                            Campaign Management: <span className="text-[#22c55e]">Admin</span>
                        </h1>
                        <p className="text-sm font-medium text-[#235347] mt-1">
                            Central Awareness Node • {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex bg-[#F4F9F5] p-1.5 rounded-2xl border border-gray-200 shadow-inner shrink-0">
                        <button onClick={() => setView('create')} className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xl active:scale-95 ${view === 'create' ? 'bg-[#051F20] text-white shadow-md' : 'text-[#235347] hover:bg-gray-200'}`}>Post Content</button>
                        <button onClick={() => setView('history')} className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xl active:scale-95 ${view === 'history' ? 'bg-[#051F20] text-white shadow-md' : 'text-[#235347] hover:bg-gray-200'}`}>Admin History</button>
                    </div>
                </div>

                {view === 'create' && (
                    <div className="bg-white border border-gray-100 shadow-[0_10px_30px_rgba(5,31,32,0.03)] rounded-2xl p-8 md:p-10 animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
                            <div className="p-3 bg-[#F4F9F5] rounded-xl text-[#22c55e] border border-gray-100 shadow-sm">
                                <Megaphone size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#051F20]">Content Composer</h2>
                                <p className="text-xs font-medium text-[#8EB69B]">Broadcast announcements, facts, or events directly to citizen home pages.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
                                    <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
                                        <AlertCircle size={20} className="text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-red-900">Operation Failed</p>
                                        <p className="text-xs text-red-700">{errorMsg}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block mb-2">Headline</label>
                                    <input required className="w-full px-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl focus:bg-white focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/10 outline-none font-bold text-sm text-[#051F20] transition-all" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Main Title..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block mb-2">Category</label>
                                    <select className="w-full px-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-[#22c55e] text-[#051F20] transition-all" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                                        <option value="News">News</option>
                                        <option value="Recycling Fact">Recycling Fact</option>
                                        <option value="Event">Event</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block mb-2">Media Source (Image URL)</label>
                                <input className="w-full px-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#22c55e] text-[#051F20] transition-all" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#235347] uppercase tracking-wider block mb-2">Content Details</label>
                                <textarea required rows="6" className="w-full px-4 py-3.5 bg-[#F4F9F5] border border-gray-200 rounded-xl font-medium text-sm leading-relaxed outline-none focus:bg-white focus:border-[#22c55e] text-[#051F20] transition-all" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} placeholder="Enter full details..."></textarea>
                            </div>

                            {showSuccess && (
                                <div className="flex items-center gap-2 text-[#22c55e] font-bold text-xs animate-bounce justify-center">
                                    <CheckCircle2 size={16} /> DATA TRANSMITTED SUCCESSFULLY TO CITIZEN NODES
                                </div>
                            )}

                            <button type="submit" disabled={loading} className="w-full bg-[#051F20] text-white font-bold py-4 rounded-xl hover:bg-[#22c55e] hover:text-[#051F20] transition-all uppercase text-xs tracking-wider cursor-pointer shadow-md active:scale-95 disabled:opacity-50">
                                {loading ? "PROCESSING..." : isEditing ? "UPDATE BROADCAST" : "PUBLISH TO CITIZENS"}
                            </button>
                        </form>
                    </div>
                )}

                {view === 'history' && (
                    <div className="space-y-4 animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        <div className="bg-white px-5 py-3.5 border border-gray-100 flex items-center gap-3 rounded-2xl shadow-sm">
                            <Search size={18} className="text-gray-400" />
                            <input type="text" placeholder="Search archives..." className="flex-1 outline-none text-sm font-medium bg-transparent text-[#051F20]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                            <table className="w-full text-left hidden md:table">
                                <thead className="bg-[#F4F9F5] border-b border-gray-100 text-xs font-bold text-[#235347] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Admin Identity</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Master Control</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-medium">
                                    {filteredPosts.map(post => (
                                        <tr key={post._id} className={`border-b border-gray-50 hover:bg-[#F4F9F5]/50 transition-colors ${post.status === 'Archived' ? 'bg-gray-50 opacity-60' : ''}`}>
                                            <td className="px-6 py-4 font-bold text-[#051F20] truncate max-w-[220px]">{post.title}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-[#051F20]">{post.postedBy || "Admin"}</span>
                                                    <span className="text-[10px] text-[#8EB69B] font-mono">ID: {post.adminId?.slice(-6) || "N/A"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${post.status === 'Archived' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                    {post.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => toggleArchive(post)} className="cursor-pointer text-gray-400 hover:text-[#22c55e] p-2 hover:bg-[#F4F9F5] rounded-xl transition-all" title="Toggle Archive">{post.status === 'Archived' ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
                                                <button onClick={() => handleEdit(post)} className="cursor-pointer text-gray-400 hover:text-[#22c55e] p-2 hover:bg-[#F4F9F5] rounded-xl transition-all" title="Edit"><Edit3 size={16}/></button>
                                                <button onClick={() => setDeleteId(post._id)} className="text-rose-400 hover:text-rose-600 cursor-pointer p-2 hover:bg-rose-50 rounded-xl transition-all" title="Delete"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* MOBILE LIST */}
                            <div className="md:hidden flex flex-col divide-y divide-gray-100">
                                {filteredPosts.map(post => (
                                    <div key={post._id} className={`p-5 flex flex-col gap-3 ${post.status === 'Archived' ? 'bg-gray-50 opacity-70' : 'bg-white'}`}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-[#051F20] text-base truncate">{post.title}</h4>
                                                <p className="text-xs font-bold text-[#8EB69B] mt-1 uppercase">{post.postedBy || "Admin"}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border shrink-0 ${post.status === 'Archived' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                {post.status || 'Active'}
                                            </span>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                                            <button onClick={() => toggleArchive(post)} className="p-2.5 bg-[#F4F9F5] text-[#235347] rounded-xl cursor-pointer flex-1 flex justify-center active:scale-95">
                                                {post.status === 'Archived' ? <Eye size={16}/> : <EyeOff size={16}/>}
                                            </button>
                                            <button onClick={() => handleEdit(post)} className="p-2.5 bg-[#F4F9F5] text-[#235347] rounded-xl cursor-pointer flex-1 flex justify-center active:scale-95">
                                                <Edit3 size={16}/>
                                            </button>
                                            <button onClick={() => setDeleteId(post._id)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl cursor-pointer flex-1 flex justify-center active:scale-95">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                            <span>EcoCycle Awareness Hub</span>
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

            {deleteId && (
                <div className="fixed inset-0 z-[150] bg-[#051F20]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-2xl max-w-sm w-full text-center animate-scaleIn">
                        <AlertCircle className="text-rose-500 mx-auto mb-4" size={36} />
                        <h3 className="text-xl font-bold mb-2 text-[#051F20]">Confirm Erase?</h3>
                        <p className="text-xs text-[#235347] mb-6 leading-relaxed">Broadcast data will be permanently terminated from community logs.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 py-3.5 bg-[#F4F9F5] font-bold rounded-xl cursor-pointer text-[#235347] hover:bg-gray-200 uppercase text-xs tracking-wider transition-all active:scale-95">Cancel</button>
                            <button onClick={handleDelete} className="flex-1 py-3.5 bg-rose-600 text-white font-bold rounded-xl cursor-pointer hover:bg-rose-700 uppercase text-xs tracking-wider shadow-md active:scale-95 transition-all">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .animate-fadeInUp { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-slideUp { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }

                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}