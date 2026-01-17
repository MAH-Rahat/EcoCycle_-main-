// client/src/pages/AuthPage.jsx
import { useState } from 'react';
import bgImage from '../assets/login-bg.jpg'; // Ensure this image exists in src/assets

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-100">
      
      {/* 1. IMAGE LAYER (Slides Left/Right) */}
      <div 
        className={`absolute top-0 h-full w-1/2 transition-all duration-1000 ease-in-out z-10 
        ${isSignUp ? 'translate-x-full' : 'translate-x-0'} hidden md:block`}
      >
        <div className="relative w-full h-full">
          <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white text-center px-10">
            <h1 className="text-5xl font-bold mb-2">
              {isSignUp ? "Welcome Back!" : "Join the Movement"}
            </h1>
            <p className="text-xl font-light tracking-wide mb-8">
              {isSignUp ? "To keep connected with us please login." : "Start your green journey today."}
            </p>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="border-2 border-white text-white font-semibold py-2 px-8 rounded-full hover:bg-white hover:text-emerald-600 transition-colors"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>

      {/* 2. FORM LAYER (Slides Left/Right) */}
      <div 
        className={`absolute top-0 h-full w-full md:w-1/2 bg-[#0F0F0F] transition-all duration-1000 ease-in-out flex flex-col justify-center items-center px-8 md:px-16
        ${isSignUp ? 'md:-translate-x-full' : 'md:translate-x-0'} 
        ${isSignUp ? 'left-0' : 'right-0'}`} 
      >
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
             <h2 className="text-3xl font-bold text-white">
              Eco<span className="text-[#84CC16]">Cycle</span>
            </h2>
          </div>

          {isSignUp ? (
            /* --- SIGN UP FORM --- */
            <div className="animate-fade-in-up w-full">
              <h2 className="text-3xl font-semibold text-white mb-6 text-center">Create Account</h2>
              <form className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-gray-500 text-xs mb-1">Name</label>
                    <input type="text" className="bg-transparent border-b border-gray-600 text-white py-2 text-sm focus:outline-none focus:border-[#84CC16]" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-gray-500 text-xs mb-1">Mobile</label>
                    <input type="text" className="bg-transparent border-b border-gray-600 text-white py-2 text-sm focus:outline-none focus:border-[#84CC16]" />
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <label className="text-gray-500 text-xs mb-1">Email</label>
                  <input type="email" className="bg-transparent border-b border-gray-600 text-white py-2 text-sm focus:outline-none focus:border-[#84CC16]" />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-500 text-xs mb-1">Password</label>
                  <input type="password" className="bg-transparent border-b border-gray-600 text-white py-2 text-sm focus:outline-none focus:border-[#84CC16]" />
                </div>

                <button className="bg-[#84CC16] text-white font-semibold py-3 rounded-lg mt-4 hover:bg-[#65a30d] transition-all shadow-lg shadow-lime-900/20 text-sm w-full">
                  Sign Up
                </button>
              </form>
              <div className="text-center mt-6 block md:hidden">
                <p className="text-gray-400 text-sm">Already have an account?</p>
                <button onClick={() => setIsSignUp(false)} className="text-blue-500 text-sm hover:underline">
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            /* --- LOGIN FORM --- */
            <div className="animate-fade-in-up w-full">
              <h2 className="text-3xl font-semibold text-white mb-6 text-center">Login</h2>
              <form className="flex flex-col gap-6">
                <div className="flex flex-col">
                  <label className="text-gray-500 text-sm mb-1">Email</label>
                  <input type="email" className="bg-transparent border-b border-gray-600 text-white py-2 focus:outline-none focus:border-[#84CC16]" />
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-500 text-sm mb-1">Password</label>
                  <input type="password" className="bg-transparent border-b border-gray-600 text-white py-2 focus:outline-none focus:border-[#84CC16]" />
                </div>
                <button className="bg-[#84CC16] text-white font-semibold py-3 rounded-lg mt-2 hover:bg-[#65a30d] transition-all shadow-lg shadow-lime-900/20 w-full">
                  Login
                </button>
              </form>
              <div className="text-center mt-8 block md:hidden">
                <p className="text-gray-400 text-sm">New here?</p>
                <button onClick={() => setIsSignUp(true)} className="text-blue-500 text-sm hover:underline">
                  Create Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}