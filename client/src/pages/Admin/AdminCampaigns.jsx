import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Megaphone, Send, Trash2, Edit3, 
    Search, History, Plus, EyeOff, Eye, Loader2, User, X, AlertCircle, 
    CheckCircle2, LayoutDashboard, Package, Gift
} from 'lucide-react';

export default function AdminCampaigns() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('create'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'News',
        imageUrl: ''
    });

    const fetchPosts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/campaigns');
            setPosts(res.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        }
    };

    useEffect(() => { fetchPosts(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const adminInfo = JSON.parse(localStorage.getItem('userInfo'));
        const adminName = adminInfo?.name || "Administrator";

        try {
            if (isEditing) {
                await axios.put(`http://localhost:5000/api/campaigns/${isEditing}`, formData);
            } else {
                await axios.post('http://localhost:5000/api/campaigns', { 
                    ...formData, 
                    postedBy: adminName,
                    status: 'Active' 
                });
            }
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
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
            await axios.put(`http://localhost:5000/api/campaigns/${post._id}`, { status: newStatus });
            setPosts(posts.map(p => p._id === post._id ? { ...p, status: newStatus } : p));
        } catch (error) {
            alert("Archive update failed.");
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`http://localhost:5000/api/campaigns/${deleteId}`);
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
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
            {/* ADMIN NAVBAR */}
            <nav className="bg-slate-900 text-white px-8 py-4 shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2 text-green-400 font-bold text-xl tracking-tighter italic">
                            EcoCycle Admin
                        </div>
                        <div className="flex gap-6">
                            <button onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer">
                                <LayoutDashboard size={16} /> Home
                            </button>
                            <button onClick={() => navigate('/admin-waste')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer">
                                <Package size={16} /> Logistics
                            </button>
                            <button onClick={() => navigate('/admin-rewards')} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer">
                                <Gift size={16} /> Rewards
                            </button>
                            <button onClick={() => navigate('/admin-campaigns')} className="flex items-center gap-2 text-sm font-bold text-white border-b-2 border-green-500 pb-1">
                                <Megaphone size={16} /> Campaigns
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {JSON.parse(localStorage.getItem('userInfo'))?.name}
                    </div>
                </div>
            </nav>

            {/* SUB-NAVBAR FOR CAMPAIGN VIEWS */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <button onClick={() => navigate('/admin-panel')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold text-base transition-all cursor-pointer">
                        <ArrowLeft size={18} /> Back to Dashboard
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setView('create')} className={`px-6 py-2 text-sm font-bold transition-all cursor-pointer rounded-md ${view === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Post Content</button>
                        <button onClick={() => setView('history')} className={`px-6 py-2 text-sm font-bold transition-all cursor-pointer rounded-md ${view === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Admin History</button>
                    </div>
                </div>
            </div>

            <main className="flex-grow flex items-center justify-center p-8">
                {view === 'create' && (
                    <div className="bg-white border border-gray-200 shadow-sm w-full max-w-4xl flex overflow-hidden min-h-[550px]">
                        <div className="w-1/3 bg-slate-900 p-10 text-white flex flex-col justify-between">
                            <div>
                                <Megaphone className="text-green-400 mb-6" size={32} />
                                <h2 className="text-2xl font-bold mb-4">Post Briefing</h2>
                                <p className="text-gray-400 text-base leading-relaxed font-normal">Compose news or recycling facts for the community.</p>
                            </div>
                        </div>
                        <div className="flex-1 p-10">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Campaign Title</label>
                                    <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded focus:border-gray-900 outline-none font-semibold text-lg" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Category</label>
                                            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded font-semibold text-sm cursor-pointer" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                                                <option value="News">News</option>
                                                <option value="Recycling Fact">Recycling Fact</option>
                                                <option value="Event">Event</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Image URL</label>
                                            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded font-semibold text-sm" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} />
                                        </div>
                                    </div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Content Details</label>
                                    <textarea required rows="6" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded font-normal text-base leading-relaxed" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})}></textarea>
                                </div>
                                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded hover:bg-black transition-all uppercase text-xs tracking-widest cursor-pointer shadow-lg">
                                    {loading ? "Processing..." : isEditing ? "Save Changes" : "Publish to Citizens"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {view === 'history' && (
                    <div className="w-full max-w-6xl space-y-6">
                        <div className="bg-white px-6 py-4 border border-gray-200 flex items-center gap-4 rounded-lg">
                            <Search size={20} className="text-gray-400" />
                            <input type="text" placeholder="Search archives..." className="flex-1 outline-none text-lg font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="bg-white border border-gray-200 overflow-hidden rounded-lg shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Title / Headline</th>
                                        <th className="px-6 py-4">Author</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Control</th>
                                    </tr>
                                </thead>
                                <tbody className="text-base font-medium">
                                    {filteredPosts.map(post => (
                                        <tr key={post._id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${post.status === 'Archived' ? 'bg-gray-50 opacity-60' : ''}`}>
                                            <td className="px-6 py-5 font-bold text-gray-800">{post.title}</td>
                                            <td className="px-6 py-5 font-semibold text-gray-600">{post.postedBy || "Admin"}</td>
                                            <td className="px-6 py-5"><span className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-tighter ${post.status === 'Archived' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>{post.status || 'Active'}</span></td>
                                            <td className="px-6 py-5 text-right flex justify-end gap-5">
                                                <button onClick={() => toggleArchive(post)} className="cursor-pointer text-gray-400 hover:text-gray-900">{post.status === 'Archived' ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
                                                <button onClick={() => handleEdit(post)} className="cursor-pointer text-gray-400 hover:text-gray-900"><Edit3 size={18}/></button>
                                                <button onClick={() => setDeleteId(post._id)} className="text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {deleteId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-2xl max-w-sm w-full text-center">
                        <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
                        <h3 className="text-xl font-bold mb-2">Delete Permanently?</h3>
                        <p className="text-sm text-gray-500 mb-8 font-normal">This record will be removed from all history.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setDeleteId(null)} className="flex-1 py-3 bg-gray-100 font-bold rounded cursor-pointer text-gray-600 hover:bg-gray-200 uppercase text-xs">Cancel</button>
                            <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded cursor-pointer hover:bg-red-700 uppercase text-xs">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}