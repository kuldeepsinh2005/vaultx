import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Loader2, Edit3 } from "lucide-react";

export default function RenameModal({ isOpen, onClose, item, onSuccess }) {
  const { api } = useAuth();
  
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine if it's a folder or a file
  const isFolder = !item?.originalName && !!item?.name;
  const currentName = isFolder ? item?.name : item?.originalName;

  useEffect(() => {
    if (isOpen && currentName) {
      setNewName(currentName);
      setError("");
    }
  }, [isOpen, currentName]);

  const handleRename = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    if (newName.trim() === currentName) {
      onClose(); 
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isFolder) {
        await api.patch(`/folders/${item._id}/rename`, { name: newName.trim() });
      } else {
        await api.patch(`/files/${item._id}/rename`, { name: newName.trim() });
      }
      
      onSuccess(); // Triggers a UI refresh
      onClose();
    } catch (err) {
      console.error("Rename failed:", err);
      setError(err.response?.data?.error || "Failed to rename item.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-3xl p-8 w-full max-w-md border border-slate-800 shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] relative">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-800/50 p-2 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Edit3 size={24} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-white font-bold text-xl tracking-tight">Rename {isFolder ? "Folder" : "File"}</h3>
            <p className="text-slate-400 text-xs mt-1 truncate">Current: {currentName}</p>
          </div>
        </div>

        <form onSubmit={handleRename}>
          <div className="mb-6">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${isFolder ? "folder" : "file"} name...`}
              className="w-full bg-slate-950/50 text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm mb-6 text-red-400 border border-red-500/20 bg-red-500/10">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading} 
              className="px-5 py-2.5 bg-transparent hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] disabled:opacity-50"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}