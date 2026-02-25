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
  const [progress, setProgress] = useState(""); // To show "Processing 5/50..."

  // Check if we are sharing a folder or a file
  // (Assuming folders have a specific flag, or lack a 'size'/'mimeType' in a certain way. 
  // Ideally, pass a type prop, but let's detect it based on your data structure)
  const isFolder = !item.originalName && !!item.name; 

  if (!isOpen || !item) return null;
const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!privateKey) { navigate("/unlock"); return; }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // 1. Get Recipient Public Key
      const userRes = await api.post("/shares/public-key", { email });
      const { userId, publicKey } = userRes.data;

      if (isFolder) {
        // === FOLDER SHARING ===
        setProgress("Fetching structure...");
        
        // A. Get files AND folders (✅ NEW DEDICATED SHARE ROUTE)
        const contentsRes = await api.get(`/shares/folder/${item._id}/recursive-contents`);
        const { files, folders } = contentsRes.data;

        const filePayload = [];
        const folderPayload = folders.map(f => f._id); // ✅ Extract Folder IDs

        // B. Re-wrap File Keys
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

        // C. Send Bulk Request with BOTH lists
        setProgress("Finalizing...");
        await api.post("/shares/bulk", {
          fileItems: filePayload,
          folderItems: folderPayload, // ✅ Send folders
          sharedWithUserId: userId
        });

        setMessage({ type: "success", text: `Shared folder & ${filePayload.length} files!` });

      } else {
        // === SINGLE FILE SHARING LOGIC ===
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
    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-3xl p-8 w-full max-w-md border border-slate-800 shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] relative">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Share2 size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-xl tracking-tight">Secure Share</h3>
            <p className="text-slate-400 text-xs flex items-center gap-1 mt-1">
              <Lock size={10} /> End-to-End Encrypted
            </p>
          </div>
        </div>

        <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3 mb-6 flex items-center gap-3">
          <div className="text-indigo-400">
            {isFolder ? <Folder size={20} /> : <Share2 size={20} />}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">
              Sharing {isFolder ? "Folder" : "File"}
            </p>
            <p className="text-slate-200 text-sm font-medium truncate">
              {item.name || item.originalName}
            </p>
          </div>
        </div>

        <form onSubmit={handleShare}>
          <div className="mb-6">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">
              Recipient Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@vaultx.com"
              className="w-full bg-slate-950/50 text-white border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
              required
            />
          </div>

          {message.text && (
            <div className={`p-4 rounded-xl text-sm mb-6 flex items-start gap-2 border ${
              message.type === "success" 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8">
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
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:shadow-none"
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