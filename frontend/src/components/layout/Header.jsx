import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";
import { Search, Bell, Shield } from "lucide-react";

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Map routes to friendly titles
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard": return "Command Center";
      case "/files": return "Secure Vault";
      default: return "Security Console";
    }
  };

  return (
    <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-10 z-20 bg-[#020617]/50 backdrop-blur-md sticky top-0">
      {/* Left Side: Page Context */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-[2px] bg-indigo-500 rounded-full hidden md:block"></div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      {/* Center: Subtle Search (Optional, looks professional) */}
      <div className="hidden lg:flex relative group w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
        <input 
          type="text" 
          placeholder="Quick search..."
          className="w-full bg-slate-900/50 border border-slate-800 text-xs text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
        />
      </div>

      {/* Right Side: System Status & Profile Icon */}
      <div className="flex items-center gap-6">
        {/* System Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">System Secure</span>
        </div>

        <button className="text-slate-500 hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#020617]"></span>
        </button>

        <div className="flex items-center gap-3 pl-6 border-l border-slate-800/50">
           <div className="w-10 h-10 bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 rounded-xl flex items-center justify-center shadow-lg group hover:border-indigo-500/50 transition-all cursor-pointer">
              <Shield size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;