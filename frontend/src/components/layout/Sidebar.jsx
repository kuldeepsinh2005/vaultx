// frontend/src/components/layout/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  LayoutDashboard, 
  Database, 
  LogOut, 
  User,
  Trash,
  CreditCard,
  Users,
  Settings
} from "lucide-react";
import { Logo } from "./Logo";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "My Vault", path: "/files", icon: Database },
    { name: "Shared with me", path: "/shared", icon: Users }, 
    { name: "Billing & Usage", path: "/billing", icon: CreditCard }, 
    { name: "Account Settings", path: "/account", icon: Settings }, 
    { name: "Trash", path: "/trash", icon: Trash },
  ];

  return (
    // Clean white background with a crisp right border and subtle shadow
    <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col items-center lg:items-start transition-all z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="p-8 w-full flex justify-center lg:justify-start">
        <Logo size="md" />
      </div>
      
      <nav className="flex-1 px-4 space-y-1.5 w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-blue-50 text-blue-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
              }`}
            >
              <item.icon 
                size={20} 
                className={isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600 transition-colors"} 
              />
              <span className={`hidden lg:block tracking-tight ${isActive ? "opacity-100" : "opacity-90"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User & Logout Section */}
      <div className="p-4 w-full border-t border-slate-200 space-y-1">
        {/* Professional User Card */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-3 mb-1 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <User size={16} strokeWidth={2.5} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider leading-none mb-1">
              Workspace
            </p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user?.username || "Admin"}
            </p>
          </div>
        </div>

        {/* Clean Logout Button */}
        <button 
          onClick={logout}
          className="flex items-center justify-center lg:justify-start gap-3 px-4 py-3 w-full text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm group"
        >
          <LogOut size={18} className="text-slate-400 group-hover:text-red-500 transition-colors" /> 
          <span className="hidden lg:block">Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;