import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Mail, Lock, Shield, TrendingUp, Zap, Briefcase } from 'lucide-react'; 

// --- SENIOR FIX: Define Helper Component OUTSIDE the main function for stability ---
const FloatingInputField = ({ icon: Icon, name, type, label, value, onChange, required=false }) => (
    <div className="relative z-0 group">
        <input
            name={name}
            type={type}
            value={value} // CRITICAL: Ensure this is correctly passed
            onChange={onChange}
            className="block w-full py-2.5 px-0 text-sm text-white bg-transparent border-0 border-b-2 border-gray-500 appearance-none focus:outline-none focus:ring-0 focus:border-[#84CC16] peer transition-all duration-300"
            placeholder=" "
            required={required}
        />
        <label 
            className={`absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6 peer-focus:text-[#84CC16]`}
        >
            <div className="flex items-center space-x-2">
                <Icon className="h-4 w-4" />
                <span>{label} {required && <span className="text-red-400">*</span>}</span>
            </div>
        </label>
    </div>
);
// ----------------------------------------------------------------------------------

export default function Signup() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
        username: '',
        password: '',
        role: 'citizen',
        adminCode: '' // Should be reset/cleared when role changes
    });

    // The key handler for all inputs
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRoleChange = (e) => {
        const newRole = e.target.value;
        setFormData(prevData => ({ 
            ...prevData, 
            role: newRole,
            // Clear adminCode if switching away from admin
            adminCode: newRole === 'admin' ? prevData.adminCode : '', 
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/register', formData);
            
            if (res.data) {
                alert("Registration Successful! Please log in.");
                navigate('/login');
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Registration failed");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden p-4">
            
            {/* --- Dynamic Background --- */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-500 opacity-20 rounded-full mix-blend-lighten filter blur-3xl animate-blob animation-delay-2000" />
                <div className="absolute bottom-1/2 left-1/4 w-96 h-96 bg-[#84CC16] opacity-30 rounded-full mix-blend-lighten filter blur-3xl animate-blob" />
            </div>

            {/* --- Signup Card (Glassmorphism Effect) --- */}
            <div 
                className="relative bg-white/10 backdrop-blur-md border border-white/20 p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-xl transform transition-all duration-700 animate-fadeInUp z-10"
            >
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-[#84CC16] drop-shadow-lg mb-1 flex items-center justify-center space-x-2">
                        <Zap className="h-8 w-8"/>
                        <span>EcoCycle Signup</span>
                    </h1>
                    <p className="text-lg font-light text-gray-200 mt-2">Start your journey to sustainability.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    
                    {/* --- Group 1: Role Selection --- */}
                    <div className="p-4 rounded-xl border border-white/20 bg-black/10">
                        <h3 className="text-lg font-bold text-gray-200 mb-3 flex items-center space-x-2">
                            <Briefcase className="h-5 w-5 text-blue-400"/>
                            <span>1. Role & Access</span>
                        </h3>
                        <div className="flex flex-col">
                            <label className="text-gray-400 text-sm block mb-1">I am registering as...</label>
                            <select 
                                name="role" 
                                onChange={handleRoleChange} // Use dedicated handler
                                className="w-full bg-white/10 text-white rounded-xl p-3 cursor-pointer focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all duration-300 border border-transparent hover:border-white/20"
                                value={formData.role} 
                            >
                                <option value="citizen" className="bg-gray-800">Citizen</option>
                                <option value="collector" className="bg-gray-800">Collector</option>
                                <option value="admin" className="bg-gray-800">Admin</option>
                            </select>
                        </div>

                        {formData.role === 'admin' && (
                            <div className="flex flex-col mt-4">
                                <FloatingInputField 
                                    icon={Shield} 
                                    name="adminCode" 
                                    type="password" 
                                    label="Admin Private Code (Required)"
                                    onChange={handleChange} // Use main handler
                                    required={true}
                                    value={formData.adminCode} // CRITICAL: Ensure value is tied to state
                                />
                            </div>
                        )}
                    </div>

                    {/* --- Group 2: Personal & Account Security --- */}
                    <div className="p-4 rounded-xl border border-white/20 bg-black/10">
                        <h3 className="text-lg font-bold text-gray-200 mb-3 flex items-center space-x-2">
                            <User className="h-5 w-5 text-[#84CC16]"/>
                            <span>2. Account Details</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                            <FloatingInputField icon={User} name="name" type="text" label="Full Name" onChange={handleChange} required={true} value={formData.name} />
                            <FloatingInputField icon={Phone} name="mobile" type="text" label="Mobile Number" onChange={handleChange} required={true} value={formData.mobile} />
                            <FloatingInputField icon={User} name="username" type="text" label="Username" onChange={handleChange} required={true} value={formData.username} />
                            <FloatingInputField icon={Mail} name="email" type="email" label="Email Address" onChange={handleChange} required={true} value={formData.email} />
                            <div className="md:col-span-2">
                                <FloatingInputField icon={Lock} name="password" type="password" label="Password" onChange={handleChange} required={true} value={formData.password} />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        className="w-full flex items-center justify-center space-x-2 bg-[#84CC16] text-gray-900 font-extrabold py-4 rounded-xl 
                                   hover:bg-[#65a30d] transition-all duration-300 shadow-xl shadow-lime-900/40 text-lg uppercase tracking-wider 
                                   transform hover:scale-[1.02] active:scale-95 ease-in-out">
                        <TrendingUp className="h-6 w-6"/>
                        <span>Create Account</span>
                    </button>
                </form>

                <div className="text-center mt-8 pt-4 border-t border-white/10">
                    <p className="text-gray-400 text-sm">
                        Already have an account? 
                        <Link to="/login" className="text-blue-400 font-medium ml-2 hover:text-blue-300 transition-colors">
                            Log in here
                        </Link>
                    </p>
                </div>
            </div>
            
            {/* CSS for custom animation (same as Login.jsx) */}
            <style jsx="true">{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeInUp {
                    animation: fadeInUp 1s ease-out;
                }
                @keyframes blob {
                    0% {
                        transform: translate(0px, 0px) scale(1);
                    }
                    33% {
                        transform: translate(30px, -50px) scale(1.1);
                    }
                    66% {
                        transform: translate(-20px, 20px) scale(0.9);
                    }
                    100% {
                        transform: translate(0px, 0px) scale(1);
                    }
                }
                .animate-blob {
                    animation: blob 10s infinite cubic-bezier(0.42, 0, 0.58, 1);
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
            `}</style>
        </div>
    );
}