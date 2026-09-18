import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock, LogIn, Zap, Eye, EyeOff, ArrowLeft, Leaf, CheckCircle2 } from 'lucide-react';

const FloatingInputField = ({ icon: Icon, name, type, label, value, onChange, required = false, delay = "0s", children }) => (
    <div className="relative z-0 w-full mb-5 group animate-slideUp opacity-0" style={{ animationDelay: delay, animationFillMode: 'forwards' }}>
        <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            className="block w-full pt-6 pb-2.5 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl appearance-none focus:outline-none focus:ring-0 focus:border-[#22c55e] focus:bg-white/10 transition-all duration-500 font-medium peer shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] autofill-fix"
            placeholder=" "
            required={required}
        />
        <label 
            className="absolute text-sm text-white/50 duration-300 transform -translate-y-3 scale-75 top-4 left-4 z-10 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-[#22c55e] font-medium pointer-events-none flex items-center gap-2"
        >
            <Icon className="h-4 w-4 transition-colors duration-300 peer-focus:text-[#22c55e]" />
            <span>{label}</span>
        </label>
        {children}
    </div>
);

export default function Login() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNavigateBack = () => {
        setIsExiting(true);
        setTimeout(() => navigate('/'), 400); // Wait for fade out
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.post(`${apiUrl}/api/auth/login`, formData); 
            
            if (res.data && res.data.success) {
                const userData = res.data.data;
                localStorage.setItem('userInfo', JSON.stringify(userData));
                localStorage.setItem('token', userData.token);
                
                // Trigger smooth success animation
                setLoading(false);
                setIsSuccess(true);
                
                // Wait 1 second for user to see the success checkmark, then fade out
                setTimeout(() => {
                    setIsExiting(true);
                    setTimeout(() => {
                        if (userData.role === 'citizen') navigate('/home'); 
                        else if (userData.role === 'admin') navigate('/admin-panel'); 
                        else if (userData.role === 'collector') navigate('/collector-dashboard');
                        else navigate('/');
                    }, 400); // Navigate after fade out finishes
                }, 1000);
            }
        } catch (error) {
            setLoading(false);
            let errorMessage = "Login failed. Please verify your connection.";
            if (error.response?.data?.error?.message) errorMessage = error.response.data.error.message;
            else if (error.response?.data?.message) errorMessage = error.response.data.message;
            else if (error.response?.status === 401) errorMessage = "Invalid email or password. Please try again.";
            
            // Add a slight delay to the alert so it doesn't interrupt the spinner abruptly
            setTimeout(() => alert(errorMessage), 100);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center bg-[#05160A] relative overflow-hidden p-4 font-sans selection:bg-[#22c55e]/30 transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            
            {/* Background Ambient Lighting with pulse animation */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#166534]/30 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[800px] h-[800px] bg-[#14532d]/40 rounded-[100px] rotate-45 blur-[80px] animate-float" />
                <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] bg-[#22c55e]/15 rounded-full blur-[100px]" />
            </div>

            {/* Back Button */}
            <div className="absolute top-8 left-8 z-20 animate-fadeIn opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                <button 
                    onClick={handleNavigateBack} 
                    className="flex items-center space-x-2 text-white/60 hover:text-[#22c55e] hover:bg-white/10 active:scale-90 transition-all duration-300 font-medium text-sm tracking-wide cursor-pointer bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"
                >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>
            </div>
            
            {/* TRUE GLASSMORPHISM CARD */}
            <div className={`relative bg-white/10 backdrop-blur-xl border border-white/20 p-10 md:p-12 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] w-full max-w-md animate-scaleUp z-10 overflow-hidden`}>
                
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[2.5rem]"></div>

                <div className="mb-10 relative z-10 animate-slideDown opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 mb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 transition-colors duration-300 cursor-default">
                        <Leaf size={14} className="text-[#22c55e] animate-pulse" />
                        <span className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">Botany</span>
                    </div>
                    
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2 drop-shadow-md">EcoCycle</h1>
                    <p className="text-sm font-medium text-white/70 leading-relaxed transition-opacity">
                        Access your dashboard to track impact, schedule pickups, and earn eco-points.
                    </p>
                </div>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8 animate-fadeIn opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}></div>

                <form onSubmit={handleSubmit} className="flex flex-col relative z-10">
                    <FloatingInputField icon={Mail} name="email" type="email" label="Email Address" value={formData.email} onChange={handleChange} required={true} delay="0.3s" />
                    
                    <FloatingInputField icon={Lock} name="password" type={showPassword ? "text" : "password"} label="Password" value={formData.password} onChange={handleChange} required={true} delay="0.4s">
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#22c55e] active:scale-75 transition-all duration-300 cursor-pointer p-1"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </FloatingInputField>

                    <div className="animate-slideUp opacity-0 mt-4" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
                        <button 
                            type="submit" 
                            disabled={loading || isSuccess}
                            className={`w-full flex items-center justify-center space-x-2 font-bold py-3.5 rounded-xl transition-all duration-500 text-sm tracking-wide shadow-lg
                                ${isSuccess 
                                    ? 'bg-[#22c55e] text-white shadow-[0_0_30px_rgba(34,197,94,0.6)] scale-[1.02]' 
                                    : 'bg-[#22c55e] text-[#05160A] hover:bg-[#4ade80] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] active:scale-95 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100'
                                }`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-[#05160A] border-t-transparent rounded-full animate-spin"></div>
                            ) : isSuccess ? (
                                <span className="flex items-center gap-2 animate-fadeIn"><CheckCircle2 size={20}/> Login Successful</span>
                            ) : (
                                <>
                                    <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                                    <span>Sign In</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="text-center mt-8 pt-6 border-t border-white/10 text-sm font-medium text-white/50 relative z-10 animate-fadeIn opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
                    Don't have an account? <Link to="/signup" className="text-[#22c55e] hover:text-[#4ade80] transition-colors ml-1 font-semibold hover:underline">Join EcoCycle</Link>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scaleUp { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes slideUp { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes slideDown { 0% { opacity: 0; transform: translateY(-15px); } 100% { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes float { 0%, 100% { transform: translateY(0) rotate(45deg); } 50% { transform: translateY(-20px) rotate(45deg); } }
                
                .animate-scaleUp { animation: scaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slideUp { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slideDown { animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-pulse-slow { animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

                input.autofill-fix:-webkit-autofill,
                input.autofill-fix:-webkit-autofill:hover, 
                input.autofill-fix:-webkit-autofill:focus, 
                input.autofill-fix:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 30px #062314 inset !important;
                    -webkit-text-fill-color: white !important;
                    transition: background-color 5000s ease-in-out 0s;
                }
            `}} />
        </div>
    );
}