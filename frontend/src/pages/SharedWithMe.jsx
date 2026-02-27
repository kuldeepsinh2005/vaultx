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
import axios from "axios";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { unwrapAESKeyWithPrivateKey, universalDecode } from "../utils/crypto";
import { runCryptoWorker } from "../utils/workerHelper";

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

  const [decryptingFolderId, setDecryptingFolderId] = useState(null);
  const [downloadPhase, setDownloadPhase] = useState(""); 
  const [downloadProgress, setDownloadProgress] = useState(0);

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

  const handleFolderDownload = async (folderRecord) => {
    try {
      if (!privateKey) { navigate("/unlock"); return; }

      const folderId = folderRecord.folder._id;
      const ownerId = folderRecord.owner._id;
      
      setDecryptingFolderId(folderId);
      setDownloadPhase("Fetching List");

      // 1. Get all unlocked files and their zip paths
      const metaRes = await api.get(`/shares/folder/${folderId}/all-contents?ownerId=${ownerId}`);
      const { files, folderName } = metaRes.data;

      if (!files || files.length === 0) {
        alert("There are no unlocked files in this folder to download.");
        setDecryptingFolderId(null);
        return;
      }

      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          setDownloadPhase(`Fetching ${i + 1}/${files.length}`);
          setDownloadProgress(Math.round((i / files.length) * 100));

          // 1️⃣ Get Pre-signed Ticket from SHARED route
          const ticketRes = await api.get(`/shares/presigned-download/${file._id}`);
          const directS3Url = ticketRes.data.url;

          // 2️⃣ Download from S3
          const res = await axios.get(directS3Url, { responseType: "blob" });
          
          // 3️⃣ Unwrap AES key specific to this user
          const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
          const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
          
          // 4️⃣ Decode IV
          const cleanIv = new Uint8Array(universalDecode(file.iv));
          
          // 5️⃣ DECRYPT in Worker
          const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
            file: res.data,
            keyData: rawAesKey, 
            iv: cleanIv
          });
          
          // 6️⃣ Add to ZIP
          const cleanPath = file.zipPath.startsWith('/') ? file.zipPath.slice(1) : file.zipPath;
          zip.file(cleanPath, decryptedBuffer);

        } catch (fileErr) {
          console.error(`FAILED TO PROCESS ${file.originalName}:`, fileErr);
        }
      }

      setDownloadPhase("Zipping");
      setDownloadProgress(100);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);

    } catch (err) {
      console.error("Folder download failed:", err);
      alert("Could not process folder download.");
    } finally {
      setDecryptingFolderId(null);
      setDownloadPhase("");
      setDownloadProgress(0);
    }
  };

  return (
    // Clean slate-50 background
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="p-6 lg:p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1400px] mx-auto w-full">
            
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div className="flex flex-col gap-1">
                {/* ✅ BREADCRUMB NAVIGATION */}
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500 mb-2">
                  <button
                    onClick={() => {
                      setFolderStack([]);
                      setCurrentFolder(null);
                      setSelectedSender(""); // Reset filter on root
                    }}
                    className="hover:text-blue-600 transition flex items-center gap-1.5"
                  >
                    <FolderOpen size={16} /> Shared Root
                  </button>

                  {folderStack.map((folderRecord, index) => {
                    const folderData = folderRecord.folder || folderRecord;
                    return (
                      <span key={folderData._id} className="flex items-center gap-2">
                        <span className="text-slate-300">/</span>
                        <button
                          onClick={() => {
                            // Slice the stack to go back to this specific level
                            const updated = folderStack.slice(0, index + 1);
                            setFolderStack(updated);
                            setCurrentFolder(updated[updated.length - 1]);
                          }}
                          className={`transition truncate max-w-[150px] ${
                            index === folderStack.length - 1
                              ? "text-slate-900 cursor-default"
                              : "text-slate-500 hover:text-blue-600"
                          }`}
                        >
                          {folderData.name}
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Title & Description */}
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  {currentFolder ? currentFolder.folder?.name || currentFolder.name : "Shared With Me"}
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  {currentFolder 
                    ? `Owned by ${currentFolder.owner?.username}` 
                    : "Files and folders securely shared with you."}
                </p>
              </div>

              {/* Filter (Only show on Root) */}
              {!currentFolder && (
                <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <Filter size={16} className="text-slate-400 mr-2.5" />
                  <select 
                    value={selectedSender} 
                    onChange={(e) => setSelectedSender(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none appearance-none pr-6 cursor-pointer"
                  >
                    <option value="" className="bg-white">All Senders</option>
                    {senders.map(sender => (
                      <option key={sender._id} value={sender._id} className="bg-white">
                        {sender.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (items.files.length === 0 && items.folders.length === 0) ? (
              // Clean Empty State
              <div className="text-center py-20 bg-white border border-slate-200 border-dashed rounded-3xl shadow-sm">
                <FolderOpen className="mx-auto w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">This folder is empty.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                
                {/* RENDER FOLDERS */}
                {items.folders.map(record => (
                  <div 
                    key={record._id} 
                    onClick={() => handleFolderClick(record)}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Crisp blue icon container */}
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shadow-sm">
                        <Folder size={24} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-bold text-slate-900 truncate">{record.folder.name}</h3>
                        <p className="text-xs font-medium text-slate-500 truncate mt-0.5">Owned by {record.owner.username}</p>
                      </div>
                    </div>
                    
                    {/* FOLDER DOWNLOAD BUTTON */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent folder navigation
                        handleFolderDownload(record);
                      }}
                      disabled={decryptingFolderId === record.folder._id}
                      className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm disabled:opacity-50 flex-shrink-0 relative overflow-hidden"
                      title="Download Folder as Zip"
                    >
                      {/* Background Progress Fill */}
                      {decryptingFolderId === record.folder._id && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-blue-100 transition-all duration-200 ease-out"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-2">
                        {decryptingFolderId === record.folder._id ? (
                          <><Loader2 size={18} className="animate-spin text-blue-600" /> <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 hidden sm:inline">{downloadPhase}</span></>
                        ) : (
                          <Download size={18} />
                        )}
                      </div>
                    </button>
                  </div>
                ))}
                
                {/* RENDER FILES */}
                {items.files.map(record => (
                  <div key={record.file._id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      {/* Dynamic Icon Container based on Lock state */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${record.isLocked ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        <FileText size={24} />
                      </div>
                      
                      {/* SHOW LOCK IF UNAVAILABLE, OTHERWISE DOWNLOAD BUTTON */}
                      {record.isLocked ? (
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-sm" title="Waiting for owner to sync keys">
                          <Lock size={12} strokeWidth={2.5} /> Locked
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(record); }}
                          disabled={downloadingId === record.file._id}
                          className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                          {downloadingId === record.file._id ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <Download size={18} />}
                        </button>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-slate-900 truncate mb-1" title={record.file.originalName}>
                      {record.file.originalName}
                    </h3>
                    
                    {/* Clean Footer Area */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                      <p className="text-xs font-medium text-slate-500">{new Date(record.file.createdAt).toLocaleDateString()}</p>
                      {record.isLocked && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Pending Sync</span>}
                    </div>
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