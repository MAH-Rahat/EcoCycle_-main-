import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import bgImage from '../assets/login-bg.jpg'; 

// Production Backend URL
const API_BASE_URL = 'https://ecocycle-p.onrender.com';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    role: 'citizen' // Default for this page
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, formData);
      
      if (res.data) {
        if (isSignUp) {
          alert("Account created! Please sign in.");
          setIsSignUp(false);
        } else {
          localStorage.setItem('userInfo', JSON.stringify(res.data));
          navigate('/home');
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-[#0F0F0F] font-sans">
      
      {/* 1. IMAGE LAYER (Desktop Sliding Overlay) */}
      <div 
        className={`absolute top-0 h-full w-1/2 transition-all duration-1000 ease-in-out z-20 
        ${isSignUp ? 'translate-x-full' : 'translate-x-0'} hidden md:block`}
      >
        <div className="relative w-full h-full overflow-hidden">
          <img src={bgImage} alt="Sustainability" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-emerald-900/40 backdrop-blur-[2px]"></div>
          
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white text-center px-10">
            <h1 className="text-5xl font-black mb-4 tracking-tighter">
              {isSignUp ? "Already a Member?" : "New to EcoCycle?"}
            </h1>
            <p className="text-lg font-medium opacity-90 mb-8 max-w-sm">
              {isSignUp ? "Sign in to continue your contribution to the planet." : "Join thousands of citizens making the world cleaner, one item at a time."}
            </p>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="border-2 border-white text-white font-black py-3 px-10 rounded-full hover:bg-white hover:text-emerald-700 transition-all uppercase text-xs tracking-widest active:scale-95"
            >
              {isSignUp ? "Switch to Sign In" : "Switch to Sign Up"}
            </button>
          </div>
        </div>
      </div>

      {/* 2. FORM LAYER */}
      <div 
        className={`absolute top-0 h-full w-full md:w-1/2 transition-all duration-1000 ease-in-out flex flex-col justify-center items-center px-6 sm:px-12 md:px-16
        ${isSignUp ? 'md:-translate-x-0' : 'md:translate-x-full'}`} 
      >
        <div className="w-full max-w-md bg-white/5 md:bg-transparent p-8 rounded-[2.5rem] border border-white/10 md:border-none">
          <div className="text-center mb-10">
             <h2 className="text-4xl font-black text-white italic tracking-tighter">
               Eco<span className="text-[#84CC16]">Cycle</span>
            </h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">Intelligence Dashboard</p>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
            {isSignUp && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                <div className="flex flex-col">
                  <label className="text-gray-500 text-[10px] font-black uppercase mb-1 ml-1">Full Name</label>
                  <input name="name" onChange={handleChange} required type="text" className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-[#84CC16] transition-all" />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-500 text-[10px] font-black uppercase mb-1 ml-1">Mobile</label>
                  <input name="mobile" onChange={handleChange} required type="text" className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-[#84CC16] transition-all" />
                </div>
              </div>
            )}
            
            <div className="flex flex-col">
              <label className="text-gray-500 text-[10px] font-black uppercase mb-1 ml-1">Email Protocol</label>
              <input name="email" onChange={handleChange} required type="email" placeholder="citizen@ecocycle.io" className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-[#84CC16] transition-all" />
            </div>

            <div className="flex flex-col">
              <label className="text-gray-500 text-[10px] font-black uppercase mb-1 ml-1">Security Key</label>
              <input name="password" onChange={handleChange} required type="password" placeholder="••••••••" className="bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-[#84CC16] transition-all" />
            </div>

            <button 
              disabled={loading}
              className="bg-[#84CC16] text-black font-black py-4 rounded-xl mt-4 hover:bg-white transition-all shadow-xl shadow-lime-900/20 text-xs uppercase tracking-[0.2em] active:scale-95 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : (isSignUp ? "Initialize Account" : "Access Dashboard")}
            </button>
          </form>

          {/* Mobile Only Toggle */}
          <div className="text-center mt-10 block md:hidden">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
              {isSignUp ? "Already have an account?" : "New to the platform?"}
            </p>
            <button 
              onClick={() => setIsSignUp(!isSignUp)} 
              className="text-[#84CC16] text-sm font-black uppercase tracking-tighter hover:underline"
            >
              {isSignUp ? "Sign In Instead" : "Create Account"}
            </button>
          </div>
        </div>
      </div>

      <style jsx="true">{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}