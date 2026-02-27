// frontend/src/components/RenameModal.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Loader2, Edit3 } from "lucide-react";

export default function RenameModal({ isOpen, onClose, item, onSuccess }) {
  const { api } = useAuth();
  
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      
      onSuccess(); 
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl border border-slate-100 relative">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100 shadow-sm">
            <Edit3 size={24} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-slate-900 font-bold text-xl tracking-tight">Rename {isFolder ? "Folder" : "File"}</h3>
            <p className="text-slate-500 font-medium text-xs mt-1 truncate">Current: {currentName}</p>
          </div>
        </div>

        <form onSubmit={handleRename}>
          <div className="mb-6">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${isFolder ? "folder" : "file"} name...`}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all placeholder:text-slate-400 shadow-sm"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl text-sm mb-6 text-red-700 font-medium border border-red-200 bg-red-50 shadow-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading} 
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm shadow-teal-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}