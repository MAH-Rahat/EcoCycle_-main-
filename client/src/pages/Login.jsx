import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock, LogIn, Zap, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const FloatingInputField = ({ icon: Icon, name, type, label, value, onChange, required = false, children }) => (
    <div className="relative z-0 group">
        <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            className="block w-full py-2.5 px-0 text-sm text-white bg-transparent border-0 border-b-2 border-gray-500 appearance-none focus:outline-none focus:ring-0 focus:border-[#84CC16] peer transition-all duration-300 font-bold"
            placeholder=" "
            required={required}
        />
        <label 
            className={`absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#84CC16] font-bold`}
        >
            <div className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
            </div>
        </label>
        {children}
    </div>
);

export default function Login() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.post(`${apiUrl}/api/auth/login`, formData); 
            
            if (res.data) {
                // FIX: Ensure clean data storage
                localStorage.setItem('userInfo', JSON.stringify(res.data));
                
                // Redirection Logic
                if (res.data.role === 'citizen') {
                    navigate('/home'); 
                } else if (res.data.role === 'admin') {
                    navigate('/admin-panel'); 
                } else if (res.data.role === 'collector') {
                    navigate('/collector-dashboard');
                } else {
                    navigate('/');
                }
            }
        } catch (error) {
            alert(error.response?.data?.message || "Login failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden p-4 font-sans">
            <div className="absolute top-8 left-8 z-20">
                <button onClick={() => navigate('/')} className="flex items-center space-x-2 text-white/50 hover:text-[#84CC16] transition-colors font-black uppercase text-xs tracking-widest cursor-pointer">
                    <ArrowLeft size={16} />
                    <span>Back to Home</span>
                </button>
            </div>
            
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-[#84CC16] opacity-20 rounded-full mix-blend-lighten filter blur-3xl animate-blob" />
                <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500 opacity-10 rounded-full mix-blend-lighten filter blur-3xl animate-blob animation-delay-4000" />
            </div>

            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md animate-fadeInUp z-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-[#84CC16] tracking-tighter mb-1 flex items-center justify-center space-x-2 uppercase italic">
                        <Zap className="h-8 w-8 fill-current"/>
                        <span>EcoCycle</span>
                    </h1>
                    <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest">Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                    <FloatingInputField icon={Mail} name="email" type="email" label="Email Address" value={formData.email} onChange={handleChange} required={true} />
                    <FloatingInputField icon={Lock} name="password" type={showPassword ? "text" : "password"} label="Password" value={formData.password} onChange={handleChange} required={true}>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-3 text-gray-400 hover:text-[#84CC16] transition-colors cursor-pointer">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </FloatingInputField>

                    <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-[#84CC16] text-gray-900 font-black py-4 rounded-2xl mt-4 hover:bg-white hover:scale-[1.02] transition-all duration-300 shadow-xl shadow-lime-900/20 text-sm uppercase tracking-[0.2em] active:scale-95 cursor-pointer">
                        <LogIn size={20}/>
                        <span>Authenticate</span>
                    </button>
                </form>

                <div className="text-center mt-8 pt-6 border-t border-white/5 text-sm font-bold text-gray-500 uppercase tracking-widest">
                    New here? <Link to="/signup" className="text-blue-400 hover:text-[#84CC16] transition-colors ml-2 underline">Join us</Link>
                </div>
            </div>
            
            <style jsx="true">{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeInUp { animation: fadeInUp 1s ease-out; }
                @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
                .animate-blob { animation: blob 10s infinite cubic-bezier(0.42, 0, 0.58, 1); }
            `}</style>
        </div>
    );
}