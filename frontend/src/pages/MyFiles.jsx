// frontend/src/pages/MyFiles.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useTransfers } from "../context/TransferContext"; // ✅ IMPORT GLOBAL MANAGER
import { buildFolderTree } from "../utils/buildTree";

import { 
  Loader2,
  AlertCircle,
  Database,
  ArrowRight,
  Share2,
  Users,
  RefreshCw,
  Edit2
} from "lucide-react";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import SyncKeysModal from "../components/SyncKeysModal";
import ShareModal from "../components/ShareModal";
import ManageAccessModal from "../components/ManageAccessModal";
import RenameModal from "../components/RenameModal";
import { ChevronRight, ChevronDown } from "lucide-react";

const FolderNode = ({ folder, depth = 0, onSelect }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [folder._id]);

  const hasChildren = folder.children?.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 hover:bg-slate-100 text-slate-700 font-medium px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren && (
          <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        <button
          onClick={() => onSelect(folder._id)}
          className="flex-1 text-left flex items-center gap-2"
        >
          <span className="text-blue-500">📁</span> {folder.name || "Root"}
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

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const MyFiles = () => {
  const { api } = useAuth();
  const { privateKey } = useKey();
  const { startGlobalDownload, startGlobalFolderDownload } = useTransfers(); // ✅ HOOK INTO ENGINE
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [movingFolder, setMovingFolder] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [manageAccessTarget, setManageAccessTarget] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [treeVersion, setTreeVersion] = useState(0);
  const [syncTarget, setSyncTarget] = useState(null);
  const [movingItem, setMovingItem] = useState(null);
  const [folderTree, setFolderTree] = useState([]);
  const [renamingItem, setRenamingItem] = useState(null);

  const isEmpty = !error && folders.length === 0 && files.length === 0;
  const hasContent = !error && (folders.length > 0 || files.length > 0);

  const refreshFolderTree = async () => {
      const res = await api.get(`/folders/tree?t=${Date.now()}`);
      setFolderTree(buildFolderTree(res.data.folders));
      setTreeVersion(v => v + 1); 
    };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    await api.post("/folders", {
      name: newFolderName,
      parent: currentFolder, 
    });

    setNewFolderName("");
    setShowCreateFolder(false);
    await refreshAll();
  };

  const moveFile = async (fileId, folderId) => {
    if (folderId === movingItem?.folder) {
      setMovingItem(null);
      return;
    }
    setMovingItem(null); 
    await api.patch(`/files/${fileId}/move`, { folderId });
    await refreshAll();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesRes, foldersRes] = await Promise.all([
          api.get("/files/my", { params: { folder: currentFolder } }),
          api.get("/folders", { params: { parent: currentFolder } }),
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

  // ✅ SIMPLIFIED DOWNLOAD HANDLERS
  const handleDownload = (file) => {
    if (!privateKey) {
      navigate("/unlock");
      return;
    }
    startGlobalDownload(file, privateKey);
  };

  const handleFolderDownload = (folderId, folderName) => {
    if (!privateKey) {
      navigate("/unlock");
      return;
    }
    startGlobalFolderDownload(folderId, folderName, privateKey);
  };

  const confirmDelete = async () => {
    try {
      if (deletingItem.type === "file") {
        await api.patch(`/files/${deletingItem.data._id}/delete`);
      } else {
        await api.patch(`/folders/${deletingItem.data._id}/delete`);
      }
      setDeletingItem(null); 
      await refreshAll(); 
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

  const refreshAll = async () => {
    await refreshFolderTree();
    const [filesRes, foldersRes] = await Promise.all([
      api.get(`/files/my?folder=${currentFolder || ''}&t=${Date.now()}`),
      api.get(`/folders?parent=${currentFolder || ''}&t=${Date.now()}`),
    ]);
    setFiles(filesRes.data.files || []);
    setFolders(foldersRes.data.folders || []);
  };
  
  useEffect(() => {
    refreshFolderTree();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Decrypting Vault Access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="flex-1 overflow-hidden flex flex-col p-6 lg:p-10">
          <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col">
            
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <button
                onClick={() => {
                  setFolderStack([]);
                  setCurrentFolder(null);
                }}
                className="hover:text-blue-600 transition"
              >
                Root
              </button>

              {folderStack.map((folder, index) => (
                <span key={folder._id} className="flex items-center gap-2">
                  <span className="text-slate-300">/</span>
                  <button
                    onClick={() => {
                      const updated = folderStack.slice(0, index + 1);
                      setFolderStack(updated);
                      setCurrentFolder(folder._id);
                    }}
                    className={`transition ${
                      index === folderStack.length - 1
                        ? "text-slate-900 cursor-default"
                        : "text-slate-500 hover:text-blue-600"
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
                className="mb-6 text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-2 w-max transition-colors"
              >
                ← Back
              </button>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3 font-semibold text-sm shadow-sm">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            {isEmpty && (
              <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-2xl shadow-sm">
                <Database className="text-slate-300 w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900">No files found</h3>
                <p className="text-slate-500 mb-8 text-sm font-medium">
                  Your secure storage is currently empty.
                </p>

                <button
                  onClick={() => {
                    navigate("/dashboard", {
                      state: {
                        targetFolder: currentFolder,
                        targetFolderName: folderStack.length > 0 ? folderStack[folderStack.length - 1].name : "Root",
                      },
                    });
                  }}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  Upload Here <ArrowRight size={18} />
                </button>
              </div>
            )}

            {hasContent && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
                
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-sm"
                    >
                      + New Folder
                    </button>

                    <button
                      onClick={() => {
                        navigate("/dashboard", {
                          state: {
                            targetFolder: currentFolder,
                            targetFolderName: folderStack.length > 0 ? folderStack[folderStack.length - 1].name : "Root",
                          },
                        });
                      }}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition shadow-sm"
                    >
                      ⬆ Upload Here
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto h-full custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200">
                        {/* ✅ REMOVED SECURITY STATE COLUMN HEADER */}
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Asset Identity</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Payload Size</th>
                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Command</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-slate-100">
                      {showCreateFolder && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={3} className="px-8 py-4">
                            <div className="flex gap-2">
                              <input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder name"
                                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm text-sm font-semibold w-64"
                                autoFocus
                              />
                              <button
                                onClick={createFolder}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold shadow-sm hover:bg-emerald-700 transition text-sm"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => setShowCreateFolder(false)}
                                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold shadow-sm hover:bg-slate-50 transition text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {folders.map((folder) => (
                        <tr key={folder._id} className="group hover:bg-slate-50 transition-colors">
                          <td
                            onClick={() => {
                              setFolderStack(prev => [...prev, folder]);
                              setCurrentFolder(folder._id);
                            }}
                            className="px-8 py-5 font-semibold text-slate-800 flex items-center gap-4 cursor-pointer group-hover:text-blue-600 transition-colors"
                          >
                            <span className="text-xl">📁</span> {folder.name}
                          </td>

                          <td></td>

                          <td className="px-8 py-5 text-right space-x-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setMovingFolder(folder)}
                              className="text-slate-400 hover:text-blue-600 text-xs font-semibold transition"
                            >
                              Move
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                prepareDelete(folder);
                              }}
                              className="text-slate-400 hover:text-red-500 text-xs font-semibold transition"
                            >
                              Delete
                            </button>
                            <button 
                              onClick={() => {
                                if(!privateKey) { navigate("/unlock"); return; }
                                setShareTarget(folder);
                              }}
                              className="text-slate-400 hover:text-indigo-500 text-xs font-semibold transition"
                            >
                              Share
                            </button>
                            {/* ✅ CLEANED UP BUTTON */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFolderDownload(folder._id, folder.name);
                              }}
                              className="text-slate-400 hover:text-emerald-600 text-xs font-semibold transition"
                            >
                              Download
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setManageAccessTarget(folder); 
                              }}
                              className="text-slate-400 hover:text-amber-500 text-xs font-semibold transition inline-flex items-center gap-1"
                            >
                              <Users size={12} /> Access
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSyncTarget(folder);
                              }}
                              className="text-slate-400 hover:text-purple-600 text-xs font-semibold transition inline-flex items-center gap-1"
                            >
                              <RefreshCw size={12} /> Sync
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingItem(folder);
                              }}
                              className="text-slate-400 hover:text-teal-600 text-xs font-semibold transition inline-flex items-center gap-1"
                            >
                              <Edit2 size={12} /> Rename
                            </button>
                          </td>
                        </tr>
                      ))}

                      {files.map((file) => (
                        <tr key={file._id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate max-w-[150px] sm:max-w-xs tracking-tight">
                                  {file.originalName}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest flex items-center gap-1 mt-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock text-slate-400" aria-hidden="true"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg> 
                                  {new Date(file.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm font-medium text-slate-500 hidden sm:table-cell">
                            {formatFileSize(file.size)}
                          </td>
                          
                          {/* ✅ REMOVED SECURITY STATE COLUMN CELL COMPLETELY */}

                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-4">
                                <button
                                  onClick={() => setMovingItem(file)}
                                  className="text-slate-400 hover:text-blue-600 text-xs font-semibold px-2 transition"
                                >
                                  Move
                                </button>
                                <button
                                  onClick={() => setDeletingItem({ type: "file", data: file })}
                                  className="text-slate-400 hover:text-red-500 text-xs font-semibold px-2 transition"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingItem(file);
                                  }}
                                  className="text-slate-400 hover:text-teal-600 text-xs font-semibold px-2 transition"
                                >
                                  Rename
                                </button>

                                <button 
                                  onClick={() => {
                                    if (!privateKey) { navigate("/unlock"); return; }
                                    setShareTarget(file);
                                  }} 
                                  className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-all shadow-sm mx-1"
                                  title="Share Securely"
                                >
                                  <Share2 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setManageAccessTarget(file); 
                                  }} 
                                  className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 rounded-lg transition-all shadow-sm mx-1"
                                  title="Manage Access"
                                >
                                  <Users size={16} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSyncTarget(file);
                                  }}
                                  className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 rounded-lg transition-all shadow-sm mx-1"
                                  title="Sync File Key"
                                >
                                  <RefreshCw size={16} />
                                </button>
                              </div>

                              {/* ✅ SIMPLIFIED DOWNLOAD BUTTON */}
                              <button 
                                onClick={() => handleDownload(file)}
                                className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest border shadow-sm bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-300"
                              >
                                <div className="relative z-10 flex items-center gap-2">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>
                                   Retrieve
                                </div>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clean Light Modals */}
        {movingItem && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-96 max-h-[80vh] overflow-y-auto shadow-xl border border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg mb-4">Move to folder</h3>

              <div className="border border-slate-200 rounded-xl p-2 mb-4">
                <FolderNode
                  key={treeVersion}
                  folder={{ name: "Root", _id: null, children: folderTree }}
                  onSelect={(targetId) => {
                    moveFile(movingItem._id, targetId);
                  }}
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setMovingItem(null)}
                  className="px-5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {movingFolder && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-96 max-h-[80vh] overflow-y-auto shadow-xl border border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg mb-4">
                Move folder: <span className="text-blue-600">{movingFolder.name}</span>
              </h3>

              <div className="border border-slate-200 rounded-xl p-2 mb-4">
                <FolderNode
                  key={treeVersion}
                  folder={{ name: "Root", _id: null, children: folderTree }}
                  onSelect={async (targetId) => {
                    if (targetId === movingFolder._id) return;
                    
                    setMovingFolder(null); 
                    
                    await api.patch(`/folders/${movingFolder._id}/move`, {
                      parent: targetId,
                    });
                     
                    await refreshAll(); 
                  }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setMovingFolder(null)}
                  className="px-5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {deletingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl border border-slate-100">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-lg">
                Delete {deletingItem.type === "file" ? "File" : "Folder"}?
              </h3>
            </div>

            <p className="text-sm font-medium text-slate-600 mb-6">
              {deletingItem.type === "folder"
                ? "This will move this folder to Trash. You can restore it later."
                : "This will move this file to Trash. You can restore it later."}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-semibold transition shadow-sm"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold transition shadow-sm shadow-red-600/20"
              >
                Delete Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Modals */}
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
          onSuccess={refreshAll} 
        />
      )}
    </div>
  );
};

export default MyFiles;