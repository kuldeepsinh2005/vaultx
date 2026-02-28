// frontend/src/pages/SharedWithMe.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useNavigate } from "react-router-dom";
import { useTransfers } from "../context/TransferContext"; 
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { 
  Download, FileText, Folder, Loader2, Filter, FolderOpen, Lock, Share2, Info
} from "lucide-react";

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function SharedWithMe() {
  const { api } = useAuth();
  const { privateKey } = useKey();
  const { startGlobalDownload, startGlobalFolderDownload } = useTransfers();
  const navigate = useNavigate();

  const [items, setItems] = useState({ files: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [senders, setSenders] = useState([]); 
  const [selectedSender, setSelectedSender] = useState(""); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let res;
        if (!currentFolder) {
          // 🔍 ROOT VIEW: Apply sender filter if selected
          const url = selectedSender ? `/shares/me?sharedBy=${selectedSender}` : "/shares/me";
          res = await api.get(url);
          
          const sharedFiles = res.data.sharedFiles || [];
          const sharedFolders = res.data.sharedFolders || [];
          
          setItems({ files: sharedFiles, folders: sharedFolders });

          // 🛠️ FIX: Populate sender list from BOTH files and folders
          // Only update the list when NO filter is active so the dropdown stays full
          if (!selectedSender) {
            const allItems = [...sharedFiles, ...sharedFolders];
            const uniqueSenders = [...new Map(
              allItems
                .filter(item => item.owner)
                .map(item => [item.owner._id, item.owner])
            ).values()];
            setSenders(uniqueSenders);
          }
        } else {
          // 📂 FOLDER VIEW: Filter is ignored here as we are inside a specific structure
          res = await api.get(`/shares/folder/${currentFolder.folder._id}/contents?ownerId=${currentFolder.owner._id}`);
          setItems({ 
            files: res.data.files || [], 
            folders: res.data.folders || [] 
          });
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, [currentFolder, selectedSender, api]);

  const handleFolderClick = (record) => {
    setFolderStack([...folderStack, record]);
    setCurrentFolder(record);
    setSelectedSender(""); // Clear filter when diving into a folder for consistency
  };

  const handleFileDownload = (record) => {
    if (!privateKey) return navigate("/unlock");
    // Ensure we use the record's file metadata but the share's specific wrappedKey
    const filePayload = { ...record.file, wrappedKey: record.wrappedKey };
    startGlobalDownload(filePayload, privateKey);
  };

  const handleFolderDownload = (record) => {
    if (!privateKey) return navigate("/unlock");
    // Global engine handles the shared folder download
    startGlobalFolderDownload(record.folder._id, record.folder.name, privateKey, true, record.owner._id);
  };

  const handleGoToRoot = () => {
    setFolderStack([]);
    setCurrentFolder(null);
    setSelectedSender(""); // Reset filter when clicking "Shared Root"
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        <div className="p-6 lg:p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1400px] mx-auto w-full">
            
            {/* Navigation & Actions Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500 mb-2">
                  <button onClick={handleGoToRoot} className="hover:text-blue-600 transition flex items-center gap-1.5">
                    <FolderOpen size={16} /> Shared Root
                  </button>
                  {folderStack.map((rec, i) => (
                    <span key={rec.folder._id} className="flex items-center gap-2">
                      <span className="text-slate-300">/</span>
                      <button 
                        onClick={() => { 
                          const up = folderStack.slice(0, i + 1); 
                          setFolderStack(up); 
                          setCurrentFolder(up[up.length - 1]); 
                        }} 
                        className={`transition ${i === folderStack.length - 1 ? "text-slate-900 cursor-default" : "text-slate-500 hover:text-blue-600"}`}
                      >
                        {rec.folder.name}
                      </button>
                    </span>
                  ))}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="text-blue-600" /> {currentFolder ? (currentFolder.folder?.name || currentFolder.name) : "Shared With Me"}
                </h2>
              </div>

              {/* Sender Filter UI */}
              {!currentFolder && senders.length > 0 && (
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm group hover:border-blue-300 transition-colors">
                  <Filter size={16} className="text-slate-400 mr-2 group-hover:text-blue-500" />
                  <select 
                    value={selectedSender} 
                    onChange={(e) => setSelectedSender(e.target.value)} 
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2"
                  >
                    <option value="">All Senders</option>
                    {senders.map(s => (
                      <option key={s._id} value={s._id}>{s.username || s.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : (items.files.length === 0 && items.folders.length === 0) ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-3xl shadow-sm border-slate-300">
                <FolderOpen className="mx-auto w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-500 font-medium">Nothing shared here matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                
                {/* RENDER FOLDERS */}
                {items.folders.map(rec => (
                  <div key={rec._id} onClick={() => handleFolderClick(rec)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100 group-hover:scale-105 transition-transform">
                        <Folder size={24} />
                      </div>
                      <div className="min-w-0 pr-2">
                        <h3 className="font-bold text-slate-900 truncate">{rec.folder?.name || "Folder"}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">By {rec.owner?.username || "System"}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFolderDownload(rec); }} 
                      className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 rounded-xl shadow-sm transition-all"
                      title="Download as Zip"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                ))}

                {/* RENDER FILES */}
                {items.files.map(rec => (
                  <div key={rec.file?._id || rec._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:border-blue-200 transition-colors group">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105 ${rec.isLocked ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        <FileText size={24} />
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {rec.isLocked ? (
                          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-widest shadow-sm">
                            <Lock size={12} /> Locked
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleFileDownload(rec)} 
                            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 rounded-xl shadow-sm transition-all"
                            title="Download File"
                          >
                            <Download size={18} />
                          </button>
                        )}
                        <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          {formatFileSize(rec.file?.size || 0)}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 truncate mb-1" title={rec.file?.originalName}>
                      {rec.file?.originalName || "Unnamed File"}
                    </h3>
                    
                    {/* Metadata Footer */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Shared by</span>
                        <span className="text-xs font-bold text-slate-700">
                          {rec.owner?.username || currentFolder?.owner?.username || "Unknown"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block text-right">Date</span>
                        <span className="text-xs font-semibold text-slate-500">
                          {rec.file?.createdAt ? new Date(rec.file.createdAt).toLocaleDateString() : "Recent"}
                        </span>
                      </div>
                    </div>

                    {rec.isLocked && (
                      <div className="mt-3 flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase bg-amber-50 p-2 rounded-lg border border-amber-100">
                        <Info size={10} /> Owner needs to sync keys
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}