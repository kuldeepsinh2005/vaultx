// frontend/src/pages/MyFiles.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { buildFolderTree } from "../utils/buildTree";
import { 
  decryptFile,  
  unwrapAESKeyWithPrivateKey,
  base64ToUint8Array,
  base64UrlToUint8Array,
  universalDecode
} from "../utils/crypto";
import { runCryptoWorker } from "../utils/workerHelper";
import { 
  Loader2,
  Lock,
  AlertCircle,
  Database,
  ArrowRight,
  Share2,
  Users,
  RefreshCw,
  Edit2
} from "lucide-react";

// Reusable UI Components
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import SyncKeysModal from "../components/SyncKeysModal";
// Add this near the top of MyFiles.jsx
import ShareModal from "../components/ShareModal";
import ManageAccessModal from "../components/ManageAccessModal";
import RenameModal from "../components/RenameModal";
import { ChevronRight, ChevronDown } from "lucide-react";
import axios from "axios";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const FolderNode = ({ folder, depth = 0, onSelect }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [folder._id]);

  const hasChildren = folder.children?.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 hover:bg-slate-800 px-2 py-1 rounded cursor-pointer"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren && (
          <button onClick={() => setOpen(!open)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        <button
          onClick={() => onSelect(folder._id)}
          className="flex-1 text-left"
        >
          📁 {folder.name || "Root"}
        </button>
      </div>

      {open &&
        folder.children?.map(child => (
          <FolderNode
            key={child._id}
            folder={child}
            depth={depth + 1}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
};




const MyFiles = () => {
  const { api } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decryptingId, setDecryptingId] = useState(null);
  const { privateKey } = useKey();
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [movingFolder, setMovingFolder] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [manageAccessTarget, setManageAccessTarget] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  // const [moveTarget, setMoveTarget] = useState(null);
  const [treeVersion, setTreeVersion] = useState(0);
  const [syncTarget, setSyncTarget] = useState(null);
  const [movingItem, setMovingItem] = useState(null);
  const [folderTree, setFolderTree] = useState([]);

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadPhase, setDownloadPhase] = useState(""); // "Downloading", "Decrypting", "Zipping"

  const isEmpty = !error && folders.length === 0 && files.length === 0;
  const hasContent = !error && (folders.length > 0 || files.length > 0);
  const [renamingItem, setRenamingItem] = useState(null);


  const navigate = useNavigate();


  const refreshFolderTree = async () => {
    const res = await api.get("/folders/tree");
    setFolderTree(buildFolderTree(res.data.folders));
    setTreeVersion(v => v + 1); // 👈 FORCE REMOUNT
  };


  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    await api.post("/folders", {
      name: newFolderName,
      parent: currentFolder, // 👈 key point
    });

    setNewFolderName("");
    setShowCreateFolder(false);

    // refresh
    const res = await api.get("/folders", {
      params: { parent: currentFolder },
    });
    setFolders(res.data.folders);
  };

  const moveFile = async (fileId, folderId) => {
    if (folderId === movingItem?.folder) {
      setMovingItem(null);
      return;
    }

    await api.patch(`/files/${fileId}/move`, {
      folderId,
    });
    await refreshAll();
  setMovingItem(null);

  };



  // useEffect(() => {
  //   if (!movingItem && !movingFolder) return;

  //   refreshFolderTree();
  // }, [movingItem, movingFolder]);



  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesRes, foldersRes] = await Promise.all([
          api.get("/files/my", {
            params: { folder: currentFolder },
          }),
          api.get("/folders", {
            params: { parent: currentFolder },
          }),
        ]);

        setFiles(filesRes.data.files || []);
        setFolders(foldersRes.data.folders || []);
      } catch {
        setError("Unable to retrieve your vault data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api, currentFolder]);


  const handleDownload = async (file) => {
    try {
      if (!privateKey) {
        navigate("/unlock");
        return;
      }

      setDecryptingId(file._id);
      setDownloadProgress(0);
      setDownloadPhase("Downloading");

      // 1️⃣ Get the Pre-signed Ticket from your backend
      const ticketRes = await api.get(`/files/presigned-download/${file._id}`);
      const directS3Url = ticketRes.data.url;

      // 2️⃣ Download DIRECTLY from AWS S3 (Using standard axios, not your custom api)
      const res = await axios.get(directS3Url, {
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(percentCompleted);
          } else {
            const mbLoaded = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
            setDownloadProgress(`${mbLoaded} MB`);
          }
        },
      });

      // 3️⃣ Switch phase & Decrypt
      // ... after downloading from AWS S3 ...
      
      setDownloadPhase("Decrypting");

      // 1️⃣ Unwrap AES key (It is now extractable!)
      const aesKey = await unwrapAESKeyWithPrivateKey(
        file.wrappedKey,
        privateKey
      );

      // 2️⃣ Export it to a Raw ArrayBuffer (100% safe to send to workers)
      const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

      // 3️⃣ Decode IV
      const originalIv = universalDecode(file.iv);
      const cleanIv = new Uint8Array(originalIv);

      // 4️⃣ 🚀 BACKGROUND DECRYPTION
      const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
        file: res.data,
        keyData: rawAesKey, // Passing the raw ArrayBuffer safely!
        iv: cleanIv
      });

      // 5️⃣ Create Download
      const blob = new Blob([decryptedBuffer], { type: file.mimeType });
      // ... existing URL creation and download logic ...
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName; 
      document.body.appendChild(a); 
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
      
    } catch (err) {
      // ✅ FIX: STOP SWALLOWING ERRORS! We need to see what is failing.
      console.error("🚨 DOWNLOAD CRASHED:", err);
      alert(`Download failed: ${err.message || err.name || "Unknown error (check console)"}`);
    } finally {
      setDecryptingId(null);
      setDownloadProgress(0);
      setDownloadPhase("");
    }
  };
  const confirmDelete = async () => {
    try {
      if (deletingItem.type === "file") {
        await api.patch(`/files/${deletingItem.data._id}/delete`);
      } else {
        await api.patch(`/folders/${deletingItem.data._id}/delete`);
      }


      await refreshFolderTree();

      const [filesRes, foldersRes] = await Promise.all([
        api.get("/files/my", { params: { folder: currentFolder } }),
        api.get("/folders", { params: { parent: currentFolder } }),
      ]);

     await refreshAll();


      setDeletingItem(null);
    } catch (err) {
      alert("Delete failed");
    }
  };

  const prepareDelete = async (folder) => {
    try {
      const res = await api.get(`/folders/${folder._id}/count`);
      setDeletingItem({
        type: "folder",
        data: folder,
        count: res.data,
      });
    } catch (err) {
      alert("Failed to get folder details");
    }
  };


  const handleFolderDownload = async (folderId, folderName) => {
    try {
      if (!privateKey) { navigate("/unlock"); return; }
      setDecryptingId(folderId);

      const metaRes = await api.get(`/folders/${folderId}/all-contents`);
      const { files } = metaRes.data;
      const zip = new JSZip();

      setDownloadPhase("Fetching");
      
      // ... previous zip initialization code ...

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Update UI Progress
          setDownloadPhase(`Fetching ${i + 1}/${files.length}`);
          setDownloadProgress(Math.round((i / files.length) * 100));

          // 1️⃣ Get the Pre-signed Ticket from your backend
          const ticketRes = await api.get(`/files/presigned-download/${file._id}`);
          const directS3Url = ticketRes.data.url;

          // 2️⃣ Download DIRECTLY from AWS S3 (Using standard axios!)
          const res = await axios.get(directS3Url, { 
            responseType: "blob" 
          });
          
          // 3️⃣ Unwrap AES key
          const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
          
          // 4️⃣ Export to Raw ArrayBuffer (100% safe to send to Web Worker)
          const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
          
          // 5️⃣ Decode IV and force a clean memory copy
          const originalIv = universalDecode(file.iv);
          const cleanIv = new Uint8Array(originalIv);
          
          // 6️⃣ 🚀 BACKGROUND DECRYPTION
          const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
            file: res.data,
            keyData: rawAesKey, 
            iv: cleanIv
          });
          
          // 7️⃣ Add the decrypted bytes to the zip file
          const cleanPath = file.zipPath.startsWith('/') ? file.zipPath.slice(1) : file.zipPath;
          zip.file(cleanPath, decryptedBuffer);

        } catch (fileErr) {
          // Keep this console error so if one file fails, it doesn't silently break the whole zip!
          console.error(`🚨 FAILED TO PROCESS ${file.originalName}:`, fileErr);
        }
      }

      // ... existing zip.generateAsync() and download logic continues ...

      // ✅ Final Phase
      setDownloadPhase("Zipping");
      setDownloadProgress(100);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);

    } catch (err) {
      console.error("Folder download failed:", err);
      alert("Could not process folder download.");
    } finally {
      setDecryptingId(null);
    }
  };

  const refreshAll = async () => {
    await refreshFolderTree();

    const [filesRes, foldersRes] = await Promise.all([
      api.get("/files/my", { params: { folder: currentFolder } }),
      api.get("/folders", { params: { parent: currentFolder } }),
    ]);

    setFiles(filesRes.data.files || []);
    setFolders(foldersRes.data.folders || []);
  };
  useEffect(() => {
    refreshFolderTree();
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Decrypting Vault Access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        {/* Dimension matched to Dashboard */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 lg:p-10">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {/* Back Navigation */}
            <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-400">
              {/* Root */}
              <button
                onClick={() => {
                  setFolderStack([]);
                  setCurrentFolder(null);
                }}
                className="hover:text-indigo-400 transition"
              >
                Root
              </button>

              {folderStack.map((folder, index) => (
                <span key={folder._id} className="flex items-center gap-2">
                  <span>/</span>
                  <button
                    onClick={() => {
                      const updated = folderStack.slice(0, index + 1);
                      setFolderStack(updated);
                      setCurrentFolder(folder._id);
                    }}
                    className={`transition ${
                      index === folderStack.length - 1
                        ? "text-white cursor-default"
                        : "text-slate-400 hover:text-indigo-400"
                    }`}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>




            {currentFolder && (
              <button
                onClick={() => {
                  const updated = [...folderStack];
                  updated.pop();

                  setFolderStack(updated);
                  setCurrentFolder(updated.length ? updated[updated.length - 1]._id : null);
                }}


                className="mb-6 text-indigo-400 font-bold text-sm flex items-center gap-2"
              >
                ← Back
              </button>
            )}

            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            {isEmpty && (
              <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-[2rem]">
                <Database className="text-slate-700 w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">No files found</h3>
                <p className="text-slate-500 mb-8 text-sm">
                  Your secure storage is currently empty.
                </p>

                <button
                  onClick={() => {
                    navigate("/dashboard", {
                      state: {
                        targetFolder: currentFolder,
                        targetFolderName:
                          folderStack.length > 0
                            ? folderStack[folderStack.length - 1].name
                            : "Root",
                      },
                    });
                  }}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-500 transition-all inline-flex items-center gap-2"
                >
                  Upload Here <ArrowRight size={18} />
                </button>
              </div>
            )}


            {hasContent && (
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden border-slate-800/50 flex flex-col flex-1">
                {/* Folder Actions Toolbar */}
                {/* Folder Actions Toolbar */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition"
                    >
                      + New Folder
                    </button>

                    <button
                      onClick={() => {
                        navigate("/dashboard", {
                          state: {
                            targetFolder: currentFolder,
                            targetFolderName:
                              folderStack.length > 0
                                ? folderStack[folderStack.length - 1].name
                                : "Root",
                          },
                        });
                      }}
                      className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl font-bold hover:bg-slate-700 transition"
                    >
                      ⬆ Upload Here
                    </button>
                  </div>
                </div>



                <div className="overflow-x-auto overflow-y-auto h-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                      <tr className="bg-slate-950/50 border-b border-slate-800">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Asset Identity</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hidden sm:table-cell">Payload Size</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hidden md:table-cell">Security State</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Command</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {/* <tr> */}
                        {/* <td colSpan={4}> */}
                          {showCreateFolder && (
                            <div className="mb-4 flex gap-2">
                              <input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder name"
                                className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700"
                              />
                              <button
                                onClick={createFolder}
                                className="px-4 py-2 bg-emerald-600 rounded-lg font-bold"
                              >
                                Create
                              </button>
                            </div>
                          )}

                          {folders.map((folder) => (
                            <tr key={folder._id} className="group hover:bg-indigo-500/[0.02]">
                              <td
                                onClick={() => {
                                  setFolderStack(prev => [...prev, folder]);
                                  setCurrentFolder(folder._id);
                                }}
                                className="px-8 py-6 font-bold text-indigo-400 flex items-center gap-4 cursor-pointer"
                              >
                                📁 {folder.name}
                              </td>

                              <td colSpan={2}></td>

                              <td className="px-8 py-6 text-right">
                                <button
                                  onClick={() => setMovingFolder(folder)}
                                  className="text-indigo-400 text-xs font-bold hover:underline"
                                >
                                  Move
                                </button>
                               <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  prepareDelete(folder);
                                }}
                                className="ml-4 text-red-400 text-xs font-bold"
                              >
                                Delete
                              </button>
                              <button 
                                onClick={() => {
                                  if(!privateKey) { navigate("/unlock"); return; }
                                  setShareTarget(folder); // ✅ Pass the folder object
                                }}
                                className="ml-3 text-blue-400 text-xs font-bold hover:underline"
                              >
                                Share
                              </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFolderDownload(folder._id, folder.name);
                                  }}
                                  className="ml-3 text-emerald-400 text-xs font-bold"
                                >
                                  {decryptingId === folder._id ? downloadPhase : "Download"}
                                </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManageAccessTarget(folder); 
                                }}
                                className="ml-3 text-amber-400 text-xs font-bold hover:underline flex items-center gap-1 inline-flex"
                              >
                                <Users size={12} /> Access
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSyncTarget(folder);
                                }}
                                className="ml-3 text-indigo-400 hover:text-indigo-300 text-xs font-bold hover:underline flex items-center gap-1 inline-flex"
                              >
                                <RefreshCw size={12} /> Sync
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingItem(folder);
                                }}
                                className="text-emerald-400 text-xs font-bold hover:underline ml-3"
                              >
                                Rename
                              </button>
                              </td>
                            </tr>
                          ))}
                          {movingFolder && (
                            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                              <div className="bg-slate-900 p-6 rounded-xl w-96 max-h-[80vh] overflow-y-auto">
                                <h3 className="font-bold mb-4">
                                  Move folder: {movingFolder.name}
                                </h3>

                                <FolderNode
                                  key={treeVersion}
                                  folder={{ name: "Root", _id: null, children: folderTree }}
                                  onSelect={async (targetId) => {
                                    if (targetId === movingFolder._id) return;
                                   await api.patch(`/folders/${movingFolder._id}/move`, {
                                      parent: targetId,
                                    });

                                    setMovingFolder(null);   // 👈 CLOSE MODAL FIRST
                                    await refreshAll();      // 👈 THEN REFRESH


                                  }}
                                />

                                <button
                                  onClick={() => setMovingFolder(null)}
                                  className="mt-4 text-sm text-slate-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {files.map((file) => (
                            <tr key={file._id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl flex items-center justify-center group-hover:border-indigo-500/30 group-hover:text-indigo-400 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>
                                  </div>
                                  <div>
                                    <p className="font-bold text-white group-hover:text-indigo-100 transition-colors truncate max-w-[150px] sm:max-w-xs uppercase tracking-tight">
                                      {file.originalName}
                                    </p>
                                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock text-indigo-500/50" aria-hidden="true"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg> 
                                      {new Date(file.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6 text-xs font-bold text-slate-500 hidden sm:table-cell">
                                {(file.size / 1024).toFixed(1)} KB
                              </td>
                              <td className="px-8 py-6 hidden md:table-cell">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/20 text-emerald-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> 
                                  AES-256
                                </span>
                                <button
                                  onClick={() => setMovingItem(file)}
                                  className="ml-3 text-indigo-400 text-xs font-bold"
                                >
                                  Move
                                </button>
                                <button
                                  onClick={() => setDeletingItem({ type: "file", data: file })}
                                  className="ml-3 text-red-400 text-xs font-bold"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingItem(file);
                                  }}
                                  className="ml-3 text-emerald-400 text-xs font-bold"
                                >
                                  Rename
                                </button>
                                <button 
                                  onClick={() => {
                                    if (!privateKey) {
                                      navigate("/unlock");
                                      return;
                                    }
                                    setShareTarget(file);
                                  }} 
                                  className="p-2.5 bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-md group-hover:shadow-[0_0_15px_-3px_rgba(79,70,229,0.3)]"
                                  title="Share Securely"
                                >
                                  <Share2 size={18} /> {/* Assuming you imported Share2 from lucide-react, or use text "Share" */}
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setManageAccessTarget(file); 
                                  }} 
                                  className="p-2.5 bg-slate-800 text-slate-300 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-md group-hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]"
                                  title="Manage Access"
                                >
                                  <Users size={18} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSyncTarget(file); // Trigger the modal with the file object
                                  }}
                                  className="p-2.5 bg-slate-800 text-slate-300 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-md group-hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
                                  title="Sync File Key"
                                >
                                  <RefreshCw size={18} />
                                </button>
                              </td>


                              <td className="px-8 py-6 text-right">
                                <button 
                                  onClick={() => handleDownload(file)}
                                  disabled={decryptingId === file._id}
                                  className={`relative overflow-hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border
                                  ${decryptingId === file._id 
                                    ? 'bg-transparent border-indigo-500/40 text-indigo-400' 
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-white hover:text-black hover:border-white shadow-xl hover:shadow-white/5'}`}
                                >
                                  {/* ✅ Smooth Background Progress Fill */}
                                  {decryptingId === file._id && downloadPhase === "Downloading" && (
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 transition-all duration-200 ease-out"
                                      style={{ width: `${downloadProgress}%` }}
                                    />
                                  )}
                                  {/* Background pulse for Decrypting phase */}
                                  {decryptingId === file._id && downloadPhase === "Decrypting" && (
                                    <div className="absolute inset-0 bg-indigo-500/20 animate-pulse" />
                                  )}
                                  
                                  <div className="relative z-10 flex items-center gap-2">
                                    {decryptingId === file._id ? (
                                      <Loader2 className="w-[14px] h-[14px] animate-spin" />
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>
                                    )}
                                    
                                    {/* Dynamic Text */}
                                    {/* ✅ THIS IS WHERE YOUR DYNAMIC TEXT GOES */}
                                    {decryptingId === file._id 
                                      ? (downloadPhase === "Downloading" 
                                          ? `FETCHING ${typeof downloadProgress === 'number' ? downloadProgress + '%' : downloadProgress}` 
                                          : "DECRYPTING...") 
                                      : "Retrieve"}
                                  </div>
                                </button>
                              </td>
                            </tr>
                          ))}
                        {/* </td> */}
                      {/* </tr> */}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        {movingItem && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-900 p-6 rounded-xl w-96 max-h-[80vh] overflow-y-auto">
              <h3 className="font-bold mb-4">Move to folder</h3>

              <FolderNode
                key={treeVersion}
                folder={{ name: "Root", _id: null, children: folderTree }}

                onSelect={(targetId) => {
                  moveFile(movingItem._id, targetId);
                }}
              />

              <button
                onClick={() => setMovingItem(null)}
                className="mt-4 text-sm text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
      {deletingItem && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-900 p-6 rounded-xl w-96">
              <h3 className="font-bold text-red-400 mb-2">
                Delete {deletingItem.type === "file" ? "File" : "Folder"}?
              </h3>

              <p className="text-sm text-slate-400 mb-4">
                {deletingItem.type === "folder"
                  ? "This will move this folder to Trash. You can restore it later."
                  : "This will move this file to Trash. You can restore it later."}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 bg-slate-700 rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 rounded font-bold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      {shareTarget && (
        <ShareModal 
          isOpen={!!shareTarget} 
          onClose={() => setShareTarget(null)} 
          item={shareTarget} 
        />
      )}
      {manageAccessTarget && (
        <ManageAccessModal 
          isOpen={!!manageAccessTarget} 
          onClose={() => setManageAccessTarget(null)} 
          item={manageAccessTarget} 
        />
      )}
      {syncTarget && (
        <SyncKeysModal 
          isOpen={!!syncTarget} 
          onClose={() => setSyncTarget(null)} 
          item={syncTarget} 
        />
      )}
      {renamingItem && (
        <RenameModal 
          isOpen={!!renamingItem} 
          onClose={() => setRenamingItem(null)} 
          item={renamingItem}
          onSuccess={refreshAll} // Automatically reloads the list when done!
        />
      )}
    </div>
  );
};

export default MyFiles;