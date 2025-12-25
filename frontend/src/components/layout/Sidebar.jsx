import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  LayoutDashboard, 
  Database, 
  LogOut, 
  User,
  Settings
} from "lucide-react";
import { Logo } from "./Logo";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Define your navigation items here for easy maintenance
  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "My Vault", path: "/files", icon: Database },
    // You can easily add more links here later
  ];

  return (
    <aside className="w-20 lg:w-64 bg-slate-950/50 backdrop-blur-xl border-r border-slate-800/50 flex flex-col items-center lg:items-start transition-all z-50">
      <div className="p-8">
        <Logo size="md" />
      </div>
      
      <nav className="flex-1 px-4 space-y-2 w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                isActive 
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-[0_0_20px_-5px_rgba(79,70,229,0.2)]" 
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <item.icon size={22} className={isActive ? "text-indigo-400" : "group-hover:scale-110 transition-transform"} />
              <span className={`hidden lg:block font-bold tracking-tight ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User & Logout Section */}
      <div className="p-4 w-full border-t border-slate-800/50 space-y-2">
        <div className="hidden lg:flex items-center gap-3 px-4 py-3 mb-2 bg-slate-900/30 rounded-xl border border-slate-800/50">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <User size={16} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Operator</p>
            <p className="text-sm font-bold text-white truncate">{user?.username || "Admin"}</p>
          </div>
        </div>

        <button 
          onClick={logout}
          className="flex items-center justify-center lg:justify-start gap-3 px-4 py-3 w-full text-slate-500 hover:text-red-400 transition-all font-black text-[10px] uppercase tracking-[0.2em]"
        >
          <LogOut size={18} /> 
          <span className="hidden lg:block">Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;