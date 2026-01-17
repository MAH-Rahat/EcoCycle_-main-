import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Megaphone, Send, Trash2, Edit3, 
    Search, History, Plus, EyeOff, Eye, Loader2, User, X, AlertCircle, 
    CheckCircle2, LayoutDashboard, Package, Gift, Users, Menu
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
            const res = await axios.get(`${API_BASE_URL}/api/campaigns`);
            setPosts(res.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        }
    };

    useEffect(() => { fetchPosts(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const adminName = adminInfo?.name || "Administrator";
        const adminId = adminInfo?._id || "Unknown ID";

        try {
            if (isEditing) {
                await axios.put(`${API_BASE_URL}/api/campaigns/${isEditing}`, formData);
            } else {
                await axios.post(`${API_BASE_URL}/api/campaigns`, { 
                    ...formData, 
                    postedBy: adminName,
                    adminId: adminId,
                    status: 'Active' 
                });
            }
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            resetForm();
            fetchPosts();
        } catch (error) {
            alert("System Error: Could not save campaign.");
        } finally {
            setLoading(false);
        }
    };

    const toggleArchive = async (post) => {
        try {
            const newStatus = post.status === 'Archived' ? 'Active' : 'Archived';
            await axios.put(`${API_BASE_URL}/api/campaigns/${post._id}`, { status: newStatus });
            setPosts(posts.map(p => p._id === post._id ? { ...p, status: newStatus } : p));
        } catch (error) {
            alert("Archive update failed.");
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`${API_BASE_URL}/api/campaigns/${deleteId}`);
            setPosts(posts.filter(p => p._id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            alert("Delete failed.");
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

    const filteredPosts = posts.filter(p => 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.postedBy && p.postedBy.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900 flex flex-col overflow-x-hidden">
            
            {/* --- TOP ADMIN NAVBAR --- */}
            <nav className="bg-slate-900 text-white px-4 py-2 shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/admin-panel')} className="p-1.5 bg-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer shadow-lg active:scale-90">
                            <LayoutDashboard size={18} />
                        </button>
                        <div className="text-green-400 font-bold text-sm tracking-tighter italic cursor-pointer hidden sm:block" onClick={() => navigate('/admin-panel')}>
                            EcoCycle Admin
                        </div>
                    </div>

                    <div className="hidden md:flex gap-4">
                        <button onClick={() => navigate('/admin-panel')} className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer transition-all">Home</button>
                        <button onClick={() => navigate('/admin-waste')} className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer">Logistics</button>
                        <button onClick={() => navigate('/admin-rewards')} className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer">Rewards</button>
                        <button onClick={() => navigate('/admin-campaigns')} className="text-[11px] font-bold text-white border-b border-green-500 pb-0.5 cursor-pointer">Campaigns</button>
                        <button onClick={() => navigate('/admin-users')} className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer">Users</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-500 uppercase hidden sm:block">{adminInfo.name}</span>
                        <button className="md:hidden p-1 cursor-pointer" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 p-4 space-y-3 border-t border-slate-800 animate-in slide-in-from-top-2 shadow-xl">
                        <button onClick={() => {navigate('/admin-panel'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-xs font-bold text-slate-300">Home</button>
                        <button onClick={() => {navigate('/admin-waste'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-xs font-bold text-slate-300">Logistics</button>
                        <button onClick={() => {navigate('/admin-campaigns'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-xs font-bold text-green-400">Campaigns</button>
                        <button onClick={() => {navigate('/admin-users'); setIsMobileMenuOpen(false);}} className="block w-full text-left text-xs font-bold text-slate-300">Users</button>
                    </div>
                )}
            </nav>

            <main className="flex-1 max-w-5xl mx-auto w-full p-3 md:p-6 space-y-4">
                
                {/* --- WELCOME HEADER --- */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">
                            Campaign Terminal: <span className="text-teal-600">{adminInfo.name}</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-80">
                            Central Awareness Management • {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                        <button onClick={() => setView('create')} className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all cursor-pointer rounded-md ${view === 'create' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Post Content</button>
                        <button onClick={() => setView('history')} className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all cursor-pointer rounded-md ${view === 'history' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Admin History</button>
                    </div>
                </div>

                {view === 'create' && (
                    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col md:flex-row overflow-hidden min-h-[400px]">
                        <div className="md:w-1/4 bg-slate-900 p-6 text-white flex flex-col justify-between border-r border-slate-800">
                            <div>
                                <Megaphone className="text-teal-400 mb-4" size={24} />
                                <h2 className="text-lg font-black uppercase tracking-tighter mb-2 italic">Composer</h2>
                                <p className="text-slate-400 text-xs leading-relaxed">Broadcast news or recycling facts to the community node.</p>
                            </div>
                        </div>
                        <div className="flex-1 p-6 md:p-8">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Headline</label>
                                            <input required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-teal-500 outline-none font-bold text-sm" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Main Title..." />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                            <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs cursor-pointer outline-none focus:border-teal-500" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                                                <option value="News">News</option>
                                                <option value="Recycling Fact">Recycling Fact</option>
                                                <option value="Event">Event</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Media Source (Image URL)</label>
                                        <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-teal-500" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Content Details</label>
                                        <textarea required rows="5" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-sm leading-relaxed outline-none focus:border-teal-500" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} placeholder="Enter full details..."></textarea>
                                    </div>
                                </div>

                                {showSuccess && (
                                    <div className="flex items-center gap-2 text-teal-600 font-black text-xs animate-bounce justify-center">
                                        <CheckCircle2 size={16} /> DATA TRANSMITTED SUCCESSFULLY
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-slate-900 text-white font-black py-3.5 rounded-xl hover:bg-teal-600 transition-all uppercase text-[11px] tracking-widest cursor-pointer shadow-lg active:scale-95">
                                    {loading ? "PROCESSING..." : isEditing ? "UPDATE BROADCAST" : "PUBLISH TO CITIZENS"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {view === 'history' && (
                    <div className="space-y-4">
                        <div className="bg-white px-4 py-2 border border-slate-200 flex items-center gap-3 rounded-xl shadow-sm">
                            <Search size={16} className="text-slate-400" />
                            <input type="text" placeholder="Search archives..." className="flex-1 outline-none text-sm font-bold bg-transparent py-1.5" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        {/* FIXED: No Horizontal Scroll on Mobile */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                            {/* TABLE HEAD: Hidden on Mobile */}
                            <table className="w-full text-left hidden md:table">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Admin Identity</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Master Control</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold">
                                    {filteredPosts.map(post => (
                                        <tr key={post._id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${post.status === 'Archived' ? 'bg-slate-50 opacity-60' : ''}`}>
                                            <td className="px-6 py-4 text-slate-800 italic uppercase tracking-tighter truncate max-w-[200px]">{post.title}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-600">{post.postedBy || "Admin"}</span>
                                                    <span className="text-[9px] text-slate-400 font-mono">ID: {post.adminId?.slice(-6) || "N/A"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black border ${post.status === 'Archived' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                                    {post.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-3">
                                                <button onClick={() => toggleArchive(post)} className="cursor-pointer text-slate-400 hover:text-teal-600 p-1.5 hover:bg-white rounded-lg transition-all">{post.status === 'Archived' ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
                                                <button onClick={() => handleEdit(post)} className="cursor-pointer text-slate-400 hover:text-teal-600 p-1.5 hover:bg-white rounded-lg transition-all"><Edit3 size={16}/></button>
                                                <button onClick={() => setDeleteId(post._id)} className="text-rose-300 hover:text-rose-600 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-all"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* MOBILE LIST: Visible only on small screens */}
                            <div className="md:hidden flex flex-col divide-y divide-slate-100">
                                {filteredPosts.map(post => (
                                    <div key={post._id} className={`p-4 flex flex-col gap-3 ${post.status === 'Archived' ? 'bg-slate-50 opacity-70' : 'bg-white'}`}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-800 uppercase tracking-tighter italic text-sm truncate">{post.title}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{post.postedBy || "Admin"}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${post.status === 'Archived' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                                {post.status || 'Active'}
                                            </span>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button onClick={() => toggleArchive(post)} className="p-2 bg-slate-50 text-slate-400 rounded-lg cursor-pointer flex-1 flex justify-center">
                                                {post.status === 'Archived' ? <Eye size={14}/> : <EyeOff size={14}/>}
                                            </button>
                                            <button onClick={() => handleEdit(post)} className="p-2 bg-slate-50 text-slate-400 rounded-lg cursor-pointer flex-1 flex justify-center">
                                                <Edit3 size={14}/>
                                            </button>
                                            <button onClick={() => setDeleteId(post._id)} className="p-2 bg-rose-50 text-rose-400 rounded-lg cursor-pointer flex-1 flex justify-center">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {deleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl max-w-xs w-full text-center animate-in zoom-in-95">
                        <AlertCircle className="text-rose-500 mx-auto mb-3" size={32} />
                        <h3 className="text-base font-black mb-1 text-slate-800">Confirm Erase?</h3>
                        <p className="text-xs text-slate-500 mb-6 font-medium italic">Broadcast data will be permanently terminated from logs.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-slate-50 font-bold rounded-xl cursor-pointer text-slate-500 hover:bg-slate-100 uppercase text-[10px] tracking-widest transition-all">Cancel</button>
                            <button onClick={handleDelete} className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl cursor-pointer hover:bg-rose-700 uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx="true">{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}