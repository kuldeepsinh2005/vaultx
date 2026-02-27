// frontend/src/components/ShareModal.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { unwrapAESKeyWithPrivateKey, wrapAESKeyWithPublicKey } from "../utils/crypto";
import { Loader2, X, Share2, Lock, Folder } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ShareModal({ isOpen, onClose, item }) {
  const { api } = useAuth();
  const { privateKey } = useKey(); 
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [progress, setProgress] = useState(""); 

  const isFolder = !item.originalName && !!item.name; 

  if (!isOpen || !item) return null;
  
  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!privateKey) { navigate("/unlock"); return; }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const userRes = await api.post("/shares/public-key", { email });
      const { userId, publicKey } = userRes.data;

      if (isFolder) {
        setProgress("Fetching structure...");
        
        const contentsRes = await api.get(`/shares/folder/${item._id}/recursive-contents`);
        const { files, folders } = contentsRes.data;

        const filePayload = [];
        const folderPayload = folders.map(f => f._id); 

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(`Encrypting ${i + 1}/${files.length}`);
          
          try {
            const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
            const newlyWrappedKey = await wrapAESKeyWithPublicKey(aesKey, publicKey);
            
            filePayload.push({
              fileId: file._id,
              wrappedKey: newlyWrappedKey
            });
          } catch (err) {
            console.warn("Skipping file:", file.originalName);
          }
        }

        setProgress("Finalizing...");
        await api.post("/shares/bulk", {
          fileItems: filePayload,
          folderItems: folderPayload, 
          sharedWithUserId: userId
        });

        setMessage({ type: "success", text: `Shared folder & ${filePayload.length} files!` });

      } else {
        const aesKey = await unwrapAESKeyWithPrivateKey(item.wrappedKey, privateKey);
        const newlyWrappedKey = await wrapAESKeyWithPublicKey(aesKey, publicKey);

        await api.post("/shares", {
          fileId: item._id,
          sharedWithUserId: userId,
          wrappedKeyForUser: newlyWrappedKey
        });

        setMessage({ type: "success", text: "File shared securely!" });
      }

      setEmail(""); 
      setTimeout(() => {
        onClose();
        setMessage({ type: "", text: "" });
        setProgress("");
      }, 2000);

    } catch (err) {
      console.error("Share error:", err);
      setMessage({ 
        type: "error", 
        text: err.response?.data?.error || "Failed to share. Check email and try again." 
      });
    } finally {
      setLoading(false);
    }
  };

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
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
            <Share2 size={24} />
          </div>
          <div>
            <h3 className="text-slate-900 font-bold text-xl tracking-tight">Secure Share</h3>
            <p className="text-emerald-600 font-semibold text-xs flex items-center gap-1.5 mt-1">
              <Lock size={12} strokeWidth={2.5} /> End-to-End Encrypted
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6 flex items-center gap-3 shadow-sm">
          <div className="text-slate-500">
            {isFolder ? <Folder size={20} /> : <Share2 size={20} />}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-0.5">
              Sharing {isFolder ? "Folder" : "File"}
            </p>
            <p className="text-slate-900 text-sm font-semibold truncate">
              {item.name || item.originalName}
            </p>
          </div>
        </div>

        <form onSubmit={handleShare}>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Recipient Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@company.com"
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all placeholder:text-slate-400 shadow-sm"
              required
            />
          </div>

          {message.text && (
            <div className={`p-4 rounded-xl text-sm mb-6 flex items-start gap-2 border font-medium shadow-sm ${
              message.type === "success" 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8">
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
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {progress || "Processing..."}</>
              ) : (
                "Grant Access"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}