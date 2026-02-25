// frontend/src/pages/SharedWithMe.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useNavigate } from "react-router-dom";
import { secureDownload } from "../utils/downloadHelper";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { 
  Download, FileText, Folder, Loader2, ArrowLeft, Filter, FolderOpen, Lock
} from "lucide-react";

export default function SharedWithMe() {
  const { api } = useAuth();
  const { privateKey } = useKey();
  const navigate = useNavigate();

  // Data State
  const [items, setItems] = useState({ files: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  // Navigation State
  const [currentFolder, setCurrentFolder] = useState(null); // null = Root
  const [folderStack, setFolderStack] = useState([]); // For "Back" button

  // Filter State
  const [senders, setSenders] = useState([]); 
  const [selectedSender, setSelectedSender] = useState(""); 

  // 1. Fetch Data (Root or Folder Contents)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let res;
        if (!currentFolder) {
          // A. Fetch Root Shares
          const url = selectedSender ? `/shares/me?sharedBy=${selectedSender}` : "/shares/me";
          res = await api.get(url);
          setItems({ 
            files: res.data.sharedFiles, 
            folders: res.data.sharedFolders 
          });

          // Extract unique senders for filter (only on root)
          if (!selectedSender && res.data.sharedFiles.length > 0) {
             const unique = [...new Map(res.data.sharedFiles.map(item => [item.owner._id, item.owner])).values()];
             setSenders(unique);
          }
        } else {
          // B. Fetch Folder Contents (Drill Down)
          res = await api.get(`/shares/folder/${currentFolder.folder._id}/contents?ownerId=${currentFolder.owner._id}`);
          setItems({ 
            files: res.data.files, 
            folders: res.data.folders 
          });
        }
      } catch (err) {
        console.error("Failed to fetch shared items", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentFolder, selectedSender, api]);

  // Navigation Handlers
  const handleFolderClick = (folderShareRecord) => {
    setFolderStack([...folderStack, folderShareRecord]);
    setCurrentFolder(folderShareRecord);
    setSelectedSender(""); // Clear filter when diving in
  };

  const handleBack = () => {
    const newStack = [...folderStack];
    newStack.pop();
    setFolderStack(newStack);
    setCurrentFolder(newStack.length > 0 ? newStack[newStack.length - 1] : null);
  };

  const handleDownload = async (record) => {
    if (!privateKey) { navigate("/unlock"); return; }
    
    setDownloadingId(record._id);
    try {
      // Fetch ticket specifically for this shared file
      const ticketRes = await api.get(`/shares/presigned-download/${record.file._id}`);
      
      await secureDownload({
        presignedUrl: ticketRes.data.url,
        wrappedKey: record.wrappedKey,
        ivBase64: record.file.iv,
        privateKey: privateKey,
        mimeType: record.file.mimeType,
        originalName: record.file.originalName
      });
    } catch (err) {
      alert("Download failed. See console.");
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="p-6 lg:p-10 overflow-y-auto">
          
          {/* Header & Breadcrumbs */}
          {/* Header & Breadcrumbs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex flex-col gap-1">
              {/* ✅ BREADCRUMB NAVIGATION */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400 mb-2">
                <button
                  onClick={() => {
                    setFolderStack([]);
                    setCurrentFolder(null);
                    setSelectedSender(""); // Reset filter on root
                  }}
                  className="hover:text-indigo-400 transition flex items-center gap-1"
                >
                  <FolderOpen size={14} /> Shared Root
                </button>

                {folderStack.map((folderRecord, index) => {
                  const folderData = folderRecord.folder || folderRecord;
                  return (
                    <span key={folderData._id} className="flex items-center gap-2">
                      <span>/</span>
                      <button
                        onClick={() => {
                          // Slice the stack to go back to this specific level
                          const updated = folderStack.slice(0, index + 1);
                          setFolderStack(updated);
                          setCurrentFolder(updated[updated.length - 1]);
                        }}
                        className={`transition truncate max-w-[150px] ${
                          index === folderStack.length - 1
                            ? "text-white cursor-default"
                            : "text-slate-400 hover:text-indigo-400"
                        }`}
                      >
                        {folderData.name}
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                {currentFolder ? currentFolder.folder?.name || currentFolder.name : "Shared With Me"}
              </h2>
              <p className="text-sm text-slate-400">
                {currentFolder 
                  ? `Owned by ${currentFolder.owner?.username}` 
                  : "Files and folders securely shared with you."}
              </p>
            </div>

            {/* Filter (Only show on Root) */}
            {!currentFolder && (
              <div className="relative flex items-center bg-slate-900/50 border border-slate-800/50 rounded-xl px-3 py-2 shadow-lg">
                <Filter size={16} className="text-slate-400 mr-2" />
                <select 
                  value={selectedSender} 
                  onChange={(e) => setSelectedSender(e.target.value)}
                  className="bg-transparent text-sm text-slate-200 outline-none appearance-none pr-4 cursor-pointer"
                >
                  <option value="" className="bg-slate-900">All Senders</option>
                  {senders.map(sender => (
                    <option key={sender._id} value={sender._id} className="bg-slate-900">
                      {sender.username}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (items.files.length === 0 && items.folders.length === 0) ? (
            <div className="text-center py-20 bg-slate-900/20 border border-slate-800 border-dashed rounded-3xl">
              <p className="text-slate-500">This folder is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* RENDER FOLDERS */}
              {items.folders.map(record => (
                <div 
                  key={record._id} 
                  onClick={() => handleFolderClick(record)}
                  className="bg-slate-900/40 backdrop-blur-sm p-5 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Folder size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-200 truncate">{record.folder.name}</h3>
                    <p className="text-xs text-slate-500 truncate">Owned by {record.owner.username}</p>
                  </div>
                </div>
              ))}

              {/* RENDER FILES */}
              {items.files.map(record => (
                <div key={record.file._id} className="bg-slate-900/40 backdrop-blur-sm p-5 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-all group flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.isLocked ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                      <FileText size={20} />
                    </div>
                    
                    {/* ✅ SHOW LOCK IF UNAVAILABLE, OTHERWISE DOWNLOAD BUTTON */}
                    {record.isLocked ? (
                      <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl flex items-center gap-2 text-xs font-bold px-3" title="Waiting for owner to sync keys">
                        <Lock size={14} /> Locked
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(record); }}
                        disabled={downloadingId === record.file._id}
                        className="p-2.5 bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-md disabled:opacity-50"
                      >
                        {downloadingId === record.file._id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                      </button>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-slate-200 truncate mb-1" title={record.file.originalName}>
                    {record.file.originalName}
                  </h3>
                  <div className="mt-auto pt-4 border-t border-slate-800/50 flex justify-between items-center">
                    <p className="text-xs text-slate-500">{new Date(record.file.createdAt).toLocaleDateString()}</p>
                    {record.isLocked && <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest">Pending Sync</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}