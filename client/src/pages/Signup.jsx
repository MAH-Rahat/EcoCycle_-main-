import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Mail, Lock, Shield, TrendingUp, Zap, Briefcase, Eye, EyeOff, ArrowLeft, Leaf, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react'; 

const FloatingInputField = ({ icon: Icon, name, type, label, value, onChange, required=false, delay="0s", children }) => (
    <div className="relative z-0 w-full mb-5 group animate-slideUp opacity-0" style={{ animationDelay: delay, animationFillMode: 'forwards' }}>
        <input
            name={name}
            type={type}
            value={value} 
            onChange={onChange}
            className="block w-full pt-6 pb-2.5 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl appearance-none focus:outline-none focus:ring-0 focus:border-[#22c55e] focus:bg-white/10 transition-all duration-300 font-medium peer shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] autofill-fix"
            placeholder=" "
            required={required}
        />
        <label 
            className="absolute text-sm text-white/50 duration-300 transform -translate-y-3 scale-75 top-4 left-4 z-10 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-[#22c55e] font-medium pointer-events-none flex items-center gap-2"
        >
            <Icon className="h-4 w-4 transition-colors duration-300 peer-focus:text-[#22c55e]" />
            <span>{label} {required && <span className="text-red-400">*</span>}</span>
        </label>
        {children}
    </div>
);

export default function Signup() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showAdminCode, setShowAdminCode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null); // Replaced alert with state
    const [formData, setFormData] = useState({
        name: '', mobile: '', email: '', username: '', password: '', role: 'citizen', adminCode: '' 
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errorMsg) setErrorMsg(null); // Clear error on type
    };

    const handleRoleChange = (e) => {
        const newRole = e.target.value;
        setFormData(prevData => ({ ...prevData, role: newRole, adminCode: newRole === 'admin' ? prevData.adminCode : '' }));
        if (errorMsg) setErrorMsg(null); // Clear error on change
    };

    const handleNavigateBack = () => {
        setIsExiting(true);
        setTimeout(() => navigate('/'), 400); 
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null); // Reset error state

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.post(`${apiUrl}/api/auth/register`, formData);
            
            if (res.data) {
                setLoading(false);
                setIsSuccess(true);
                
                // Show success animation, then fade out and navigate to login
                setTimeout(() => {
                    setIsExiting(true);
                    setTimeout(() => navigate('/login'), 400); 
                }, 1500); 
            }
        } catch (error) {
            setLoading(false);
            let errorMessage = "Registration failed. Please check your connection.";
            if (error.response?.status === 409) {
                const errorData = error.response?.data;
                if (errorData?.message?.toLowerCase().includes('email')) errorMessage = "This email is already registered.";
                else if (errorData?.message?.toLowerCase().includes('username')) errorMessage = "This username is taken.";
                else errorMessage = "Email or username already registered.";
            } else if (error.response?.status === 400) errorMessage = error.response?.data?.message || "Invalid input parameters.";
            else if (error.response?.status === 403) errorMessage = "Invalid admin code provided.";
            
            // Set error state instead of using alert()
            setErrorMsg(errorMessage);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center bg-[#05160A] relative overflow-hidden p-4 sm:p-8 font-sans selection:bg-[#22c55e]/30 transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#166534]/30 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[800px] h-[800px] bg-[#14532d]/40 rounded-[100px] rotate-45 blur-[80px] animate-float" />
                <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-[#22c55e]/15 rounded-full blur-[100px]" />
            </div>

            <div className="absolute top-8 left-8 z-20 animate-fadeIn opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                <button onClick={handleNavigateBack} className="flex items-center space-x-2 text-white/60 hover:text-[#22c55e] hover:bg-white/10 active:scale-90 transition-all duration-300 font-medium text-sm tracking-wide cursor-pointer bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>
            </div>

            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] w-full max-w-2xl animate-scaleUp z-10 my-16 md:my-0">
                
                <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[2.5rem]"></div>

                <div className="text-center mb-8 relative z-10 animate-slideDown opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                    <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 transition-colors duration-300">
                        <Leaf size={14} className="text-[#22c55e] animate-pulse" />
                        <span className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">Registration</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2 drop-shadow-md">Join EcoCycle</h1>
                    <p className="text-sm font-medium text-white/60">Start your journey to a sustainable future.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                    
                    {/* Role Selection Group */}
                    <div className="p-6 rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] animate-slideUp opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        <h3 className="text-sm font-bold text-white/90 mb-4 flex items-center space-x-2 tracking-wide">
                            <Briefcase className="h-4 w-4 text-[#22c55e]"/>
                            <span>1. Role & Access</span>
                        </h3>
                        <div className="flex flex-col relative group">
                            <select 
                                name="role" onChange={handleRoleChange} 
                                className="w-full bg-white/5 text-white border border-white/10 rounded-xl p-3.5 pr-10 focus:outline-none focus:border-[#22c55e] hover:bg-white/10 focus:bg-white/10 transition-all duration-300 font-medium appearance-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] cursor-pointer"
                                value={formData.role} 
                            >
                                <option value="citizen" className="bg-[#05160A] text-white">Citizen</option>
                                <option value="collector" className="bg-[#05160A] text-white">Collector</option>
                                <option value="admin" className="bg-[#05160A] text-white">Admin</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 group-hover:text-white transition-colors pointer-events-none" size={18} />
                        </div>

                        {formData.role === 'admin' && (
                            <div className="flex flex-col mt-5 animate-slideDown">
                                <FloatingInputField icon={Shield} name="adminCode" type={showAdminCode ? "text" : "password"} label="Admin Private Code" onChange={handleChange} required={true} value={formData.adminCode} delay="0s">
                                    <button type="button" onClick={() => setShowAdminCode(!showAdminCode)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#22c55e] active:scale-75 transition-all duration-300 cursor-pointer p-1">
                                        {showAdminCode ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </FloatingInputField>
                            </div>
                        )}
                    </div>

                    {/* Account Details Group */}
                    <div className="p-6 rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] animate-slideUp opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                        <h3 className="text-sm font-bold text-white/90 mb-5 flex items-center space-x-2 tracking-wide">
                            <User className="h-4 w-4 text-[#22c55e]"/>
                            <span>2. Account Details</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
                            <FloatingInputField icon={User} name="name" type="text" label="Full Name" onChange={handleChange} required={true} value={formData.name} delay="0.4s" />
                            <FloatingInputField icon={Phone} name="mobile" type="text" label="Mobile Number" onChange={handleChange} required={true} value={formData.mobile} delay="0.5s"/>
                            <FloatingInputField icon={User} name="username" type="text" label="Username" onChange={handleChange} required={true} value={formData.username} delay="0.6s"/>
                            <FloatingInputField icon={Mail} name="email" type="email" label="Email Address" onChange={handleChange} required={true} value={formData.email} delay="0.7s"/>
                            
                            <div className="md:col-span-2">
                                <FloatingInputField icon={Lock} name="password" type={showPassword ? "text" : "password"} label="Password" onChange={handleChange} required={true} value={formData.password} delay="0.8s">
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#22c55e] active:scale-75 transition-all duration-300 cursor-pointer p-1">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </FloatingInputField>
                            </div>
                        </div>
                    </div>

                    <div className="animate-slideUp opacity-0 mt-2" style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}>
                        {/* INLINE PROFESSIONAL ERROR MESSAGE */}
                        {errorMsg && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 mb-4 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)] animate-fadeIn">
                                <div className="bg-red-500/20 p-2 rounded-lg flex-shrink-0">
                                    <AlertCircle size={20} className="text-red-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-red-400">Registration Failed</p>
                                    <p className="text-xs text-red-300/80">{errorMsg}</p>
                                </div>
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={loading || isSuccess}
                            className={`w-full flex items-center justify-center space-x-2 font-bold py-4 rounded-xl transition-all duration-500 text-sm tracking-wide shadow-lg
                                ${isSuccess 
                                    ? 'bg-[#22c55e] text-white shadow-[0_0_30px_rgba(34,197,94,0.6)] scale-[1.02]' 
                                    : 'bg-[#22c55e] text-[#05160A] hover:bg-[#4ade80] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] active:scale-95 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100'
                                }`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-[#05160A] border-t-transparent rounded-full animate-spin"></div>
                            ) : isSuccess ? (
                                <span className="flex items-center gap-2 animate-fadeIn"><CheckCircle2 size={20}/> Registration Successful</span>
                            ) : (
                                <>
                                    <TrendingUp size={18} className="group-hover:translate-x-1 transition-transform" />
                                    <span>Create Account</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="text-center mt-8 pt-6 border-t border-white/10 text-sm font-medium text-white/50 relative z-10 animate-fadeIn opacity-0" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>
                    Already have an account? 
                    <button onClick={() => { setIsExiting(true); setTimeout(() => navigate('/login'), 400); }} className="text-[#22c55e] font-semibold ml-1 hover:text-[#4ade80] transition-colors hover:underline cursor-pointer">
                        Log in here
                    </button>
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
                .animate-slideDown { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
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