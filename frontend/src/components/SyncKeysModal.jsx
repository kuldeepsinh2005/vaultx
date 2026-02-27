// frontend/src/components/SyncKeysModal.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { unwrapAESKeyWithPrivateKey, wrapAESKeyWithPublicKey } from "../utils/crypto";
import { X, RefreshCw, Loader2, CheckCircle, ShieldAlert } from "lucide-react";

export default function SyncKeysModal({ isOpen, onClose, item }) {
  const { api } = useAuth();
  const { privateKey } = useKey();
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState([]);
  const [progress, setProgress] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isFolder = !item?.originalName && !!item?.name;
  const itemName = isFolder ? item?.name : item?.originalName;

  useEffect(() => {
    if (isOpen && item) {
      scanForMissingKeys();
    }
  }, [isOpen, item]);

  const scanForMissingKeys = async () => {
    try {
      setLoading(true);
      setSuccessMsg("");
      const type = isFolder ? 'folder' : 'file';
      const res = await api.get(`/shares/item/${item._id}/pending-sync?type=${type}`);
      setPendingSyncs(res.data.pendingSyncs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!privateKey) {
      alert("Vault is locked! Please unlock your vault to sync keys.");
      return;
    }

    setSyncing(true);
    let totalKeysSynced = 0;

    try {
      for (const syncJob of pendingSyncs) {
        setProgress(`Encrypting keys for ${syncJob.user.username}...`);
        const filePayload = [];

        for (let i = 0; i < syncJob.files.length; i++) {
          const file = syncJob.files[i];
          try {
            const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
            const newlyWrappedKey = await wrapAESKeyWithPublicKey(aesKey, syncJob.user.publicKey);
            
            filePayload.push({
              fileId: file._id,
              wrappedKey: newlyWrappedKey
            });
            totalKeysSynced++;
          } catch (cryptoErr) {
            console.warn(`Failed to process file ${file.originalName}`, cryptoErr);
          }
        }

        if (filePayload.length > 0) {
          await api.post("/shares/bulk", {
            fileItems: filePayload,
            folderItems: [], 
            sharedWithUserId: syncJob.user._id
          });
        }
      }

      setSuccessMsg(`Successfully synchronized ${totalKeysSynced} keys!`);
      setPendingSyncs([]); 
      
      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (err) {
      console.error("Sync failed", err);
      alert("A network error occurred during sync.");
    } finally {
      setSyncing(false);
      setProgress("");
    }
  };

  if (!isOpen || !item) return null;
  const totalMissingFiles = pendingSyncs.reduce((acc, job) => acc + job.files.length, 0);

  return (
    // Clean, light blur overlay
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      
      {/* Crisp white modal card with soft shadow */}
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl border border-slate-100 relative">
        
        {!syncing && (
          /* Subtle close button */
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-4 mb-6">
          {/* Professional Purple Icon Container for 'Sync' vibe */}
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm">
            <RefreshCw size={24} className={syncing ? "animate-spin" : ""} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-slate-900 font-bold text-xl tracking-tight">
              Sync {isFolder ? "Folder" : "File"} Keys
            </h3>
            <p className="text-slate-500 font-medium text-xs mt-1 truncate">{itemName}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-purple-600 mb-3 w-8 h-8" />
            <p className="text-slate-500 font-medium text-sm">Scanning for missing keys...</p>
          </div>
        ) : successMsg ? (
          <div className="flex flex-col items-center justify-center py-8 text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100">
            <CheckCircle className="w-12 h-12 mb-3" />
            <p className="font-bold">{successMsg}</p>
          </div>
        ) : pendingSyncs.length === 0 ? (
          // Clean empty state
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-900 font-bold">Everything is up to date!</p>
            <p className="text-slate-500 font-medium text-xs mt-1">All recipients have access to the latest files.</p>
          </div>
        ) : (
          <div>
            {/* Crisp info box */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 shadow-sm">
              <p className="text-sm font-medium text-slate-700 mb-1">
                Found <span className="font-bold text-purple-600">{totalMissingFiles}</span> locked files across <span className="font-bold text-purple-600">{pendingSyncs.length}</span> users.
              </p>
              <p className="text-xs font-medium text-slate-500 mt-2">
                Your browser will now decrypt and re-wrap these keys to grant access.
              </p>
            </div>

            <button 
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-sm shadow-purple-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress}</> : "Start Cryptographic Sync"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}