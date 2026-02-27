// frontend/src/components/ManageAccessModal.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, UserMinus, User, Loader2, ShieldAlert } from "lucide-react";

export default function ManageAccessModal({ isOpen, onClose, item }) {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if it's a folder (has 'name') or file (has 'originalName')
  const isFolder = !!item?.name; 

  useEffect(() => {
    if (isOpen && item) {
      fetchAccessList();
    }
  }, [isOpen, item]);

  const fetchAccessList = async () => {
    try {
      setLoading(true);
      const res = await api.get("/shares/access-list", {
         params: { itemId: item._id, type: isFolder ? 'folder' : 'file' }
      });
      setUsers(res.data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId) => {
    try {
      await api.post("/shares/revoke", {
        shareId,
        type: isFolder ? 'folder' : 'file'
      });
      // Remove from UI immediately
      setUsers(users.filter(u => u.shareId !== shareId));
    } catch (err) {
      alert("Failed to revoke access");
    }
  };

  if (!isOpen || !item) return null;

  return (
    // Clean, light blur overlay
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      
      {/* Crisp white modal card with soft shadow */}
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl border border-slate-100 relative">
        
        {/* Subtle close button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          {/* Professional Amber Icon Container for 'Access/Warning' vibe */}
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm">
            <ShieldAlert size={24} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-slate-900 font-bold text-xl tracking-tight">Access Control</h3>
            <p className="text-slate-500 font-medium text-xs mt-1 truncate">
              {item.name || item.originalName}
            </p>
          </div>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-amber-500" />
            </div>
          ) : users.length === 0 ? (
            // Clean empty state
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <p className="text-slate-500 font-semibold text-sm">Not shared with anyone.</p>
            </div>
          ) : (
            users.map(user => (
              // Crisp, high-contrast user rows
              <div key={user.shareId} className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-500">
                    <User size={16}/>
                  </div>
                  <div>
                    <p className="text-sm text-slate-900 font-bold">{user.username}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{user.email}</p>
                  </div>
                </div>
                {/* Clear, readable revoke button */}
                <button 
                  onClick={() => handleRevoke(user.shareId)}
                  className="text-red-600 hover:bg-red-600 hover:text-white p-2.5 rounded-xl transition-colors bg-red-50 shadow-sm"
                  title="Revoke Access"
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}