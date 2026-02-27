// frontend/src/components/layout/Header.jsx
import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";
import { Search, Bell, Shield } from "lucide-react";

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Map routes to friendly, professional titles to match the Sidebar
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/dashboard": return "Dashboard";
      case "/files": return "My Vault";
      case "/shared": return "Shared with me";
      case "/billing": return "Billing & Usage";
      case "/account": return "Account Settings";
      case "/trash": return "Trash";
      default: return "Workspace";
    }
  };

  return (
    // Crisp white background with a soft blur and clean slate border
    <header className="h-20 border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 z-20 bg-white/80 backdrop-blur-md sticky top-0 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
      
      {/* Left Side: Page Context */}
      <div className="flex items-center gap-3">
        {/* Professional blue accent bar */}
        <div className="h-6 w-[3px] bg-blue-600 rounded-full hidden md:block"></div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      {/* Center: Clean, modern Search Bar */}
      {/* <div className="hidden lg:flex relative group w-72">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        <input 
          type="text" 
          placeholder="Search encrypted files..."
          className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 transition-all shadow-sm"
        />
      </div> */}

      {/* Right Side: System Status & Profile Icon */}
      <div className="flex items-center gap-5 lg:gap-6">
        
        {/* Trustworthy System Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-700">End-to-End Encrypted</span>
        </div>

        {/* Professional Notification Bell */}
        <button className="text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-2 rounded-lg transition-colors relative">
          <Bell size={20} />
          {/* Crisp blue notification dot with a white border */}
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white box-content"></span>
        </button>

        {/* Clean Profile/Shield Icon */}
        <div className="flex items-center gap-3 pl-5 lg:pl-6 border-l border-slate-200">
           <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm group hover:border-blue-300 hover:shadow transition-all cursor-pointer">
              <Shield size={20} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
           </div>
        </div>
      </div>
    </header>
  );
};

export default Header;