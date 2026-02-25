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
      // ✅ Pass the type parameter to the API!
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
      // Loop through every user who is missing keys
      for (const syncJob of pendingSyncs) {
        setProgress(`Encrypting keys for ${syncJob.user.username}...`);
        const filePayload = [];

        // Loop through the files this user is missing
        for (let i = 0; i < syncJob.files.length; i++) {
          const file = syncJob.files[i];
          try {
            // 1. Unwrap with Owner's Private Key
            const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
            // 2. Rewrap with Recipient's Public Key
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

        // 3. Send bulk update for this user (reusing the /shares/bulk route we made earlier!)
        if (filePayload.length > 0) {
          await api.post("/shares/bulk", {
            fileItems: filePayload,
            folderItems: [], 
            sharedWithUserId: syncJob.user._id
          });
        }
      }

      setSuccessMsg(`Successfully synchronized ${totalKeysSynced} keys!`);
      setPendingSyncs([]); // Clear the list
      
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
    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-3xl p-8 w-full max-w-md border border-slate-800 shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] relative">
        {!syncing && (
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-800/50 p-2 rounded-full transition-all">
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <RefreshCw size={24} className={syncing ? "animate-spin" : ""} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-white font-bold text-xl tracking-tight">
              Sync {isFolder ? "Folder" : "File"} Keys
            </h3>
            <p className="text-slate-400 text-xs mt-1 truncate">{itemName}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-indigo-500 mb-2 w-8 h-8" />
            <p className="text-slate-400 text-sm">Scanning for missing keys...</p>
          </div>
        ) : successMsg ? (
          <div className="flex flex-col items-center justify-center py-8 text-emerald-400">
            <CheckCircle className="w-12 h-12 mb-3" />
            <p className="font-bold">{successMsg}</p>
          </div>
        ) : pendingSyncs.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-slate-800">
            <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-slate-300 font-bold">Everything is up to date!</p>
            <p className="text-slate-500 text-xs mt-1">All recipients have access to the latest files.</p>
          </div>
        ) : (
          <div>
            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl mb-6">
              <p className="text-sm text-slate-300 mb-1">
                Found <span className="font-bold text-indigo-400">{totalMissingFiles}</span> locked files across <span className="font-bold text-indigo-400">{pendingSyncs.length}</span> users.
              </p>
              <p className="text-xs text-slate-500">
                Your browser will now decrypt and re-wrap these keys to grant access.
              </p>
            </div>

            <button 
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(79,70,229,0.4)] disabled:opacity-50"
            >
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress}</> : "Start Cryptographic Sync"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}