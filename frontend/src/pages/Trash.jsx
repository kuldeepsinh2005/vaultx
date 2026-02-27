// frontend/src/pages/Trash.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { Loader2, Folder, FolderOpen, FileText, AlertTriangle } from "lucide-react";

const TrashFolderNode = ({ folder, refreshTrash, setConfirmDelete }) => {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-4 border-l-2 border-slate-200 pl-4 mt-3">
      <div className="flex justify-between items-center group">
        <div
          className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 hover:text-blue-600 transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <FolderOpen size={18} className="text-blue-500" />
          ) : (
            <Folder size={18} className="text-blue-500" />
          )}
          {folder.name}
        </div>

        {folder.isRoot && (
          <div className="flex gap-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-lg font-semibold transition"
              onClick={async () => {
                await api.patch(`/trash/folder/${folder._id}/restore`);
                refreshTrash();
              }}
            >
              Restore
            </button>

            <button
              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg font-semibold transition"
              onClick={() => {
                setConfirmDelete({
                  type: "folder",
                  id: folder._id,
                  name: folder.name
                });
              }}
            >
              Delete Forever
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="ml-2 mt-3 space-y-2">
          {/* Files inside this folder */}
          {folder.files?.map(file => (
            <div
              key={file._id}
              className="flex justify-between items-center bg-white border border-slate-200 shadow-sm p-3 rounded-xl text-sm hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center gap-3 text-slate-700 font-medium">
                <FileText size={16} className="text-slate-400" /> 
                {file.originalName}
              </div>
            </div>
          ))}

          {/* Child folders */}
          {folder.children?.map(child => (
            <TrashFolderNode
              key={child._id}
              folder={child}
              refreshTrash={refreshTrash}
              setConfirmDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Trash() {
  const { api } = useAuth();
  const [trash, setTrash] = useState({ folders: [], files: [] });
  const [confirmDelete, setConfirmDelete] = useState(null);
  
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshTrash = async () => {
    try {
      const res = await api.get("/trash");
      setTrash(res.data);
    } catch (error) {
      console.error("Failed to fetch trash:", error);
    }
  };

  useEffect(() => {
    refreshTrash();
  }, []);

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      if (confirmDelete.type === "file") {
        await api.delete(`/trash/file/${confirmDelete.id}`);
      } else {
        await api.delete(`/trash/folder/${confirmDelete.id}`);
      }
      
      await refreshTrash();
      setConfirmDelete(null); 
    } catch (err) {
      console.error("Failed to permanently delete:", err);
      alert("Error deleting item. Please try again.");
    } finally {
      setIsDeleting(false); 
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="p-6 lg:p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 tracking-tight">Trash</h2>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 lg:p-8">
              
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Folders</h3>
              {trash.folders.length === 0 && (
                <p className="text-slate-500 font-medium text-sm mb-8 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  No folders in trash
                </p>
              )}

              <div className="mb-10">
                {trash.folders?.map(folder => (
                  <TrashFolderNode
                    key={folder._id}
                    folder={folder}
                    refreshTrash={refreshTrash}
                    setConfirmDelete={setConfirmDelete}
                  />
                ))}
              </div>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Loose Files</h3>
              {trash.files.length === 0 && (
                <p className="text-slate-500 font-medium text-sm bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  No loose files in trash
                </p>
              )}

              <div className="space-y-3">
                {trash.files?.map(file => (
                  <div
                    key={file._id}
                    className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl text-sm shadow-sm hover:border-blue-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3 text-slate-800 font-semibold">
                      <FileText size={18} className="text-slate-400" /> 
                      {file.originalName}
                    </div>
                    
                    <div className="flex gap-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-lg font-semibold transition shadow-sm"
                        onClick={async () => {
                          await api.patch(`/trash/file/${file._id}/restore`);
                          refreshTrash();
                        }}
                      >
                        Restore
                      </button>

                      <button
                        className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg font-semibold transition shadow-sm"
                        onClick={() => {
                          setConfirmDelete({
                            type: "file",
                            id: file._id,
                            name: file.originalName
                          });
                        }}
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Crisp White Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100 shadow-sm">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-slate-900 font-bold text-xl tracking-tight">
                Permanently delete {confirmDelete.type}?
              </h3>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-8">
              <p className="text-sm font-semibold text-slate-900 truncate mb-1">
                {confirmDelete.name}
              </p>
              <p className="text-xs font-medium text-slate-500">
                This action <span className="text-red-600 font-bold">cannot be undone</span>.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 disabled:opacity-50 transition shadow-sm"
              >
                Cancel
              </button>

              <button
                onClick={handlePermanentDelete}
                disabled={isDeleting}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm ${
                  isDeleting 
                    ? "bg-red-100 text-red-400 border border-red-200 cursor-not-allowed" 
                    : "bg-red-600 text-white hover:bg-red-700 shadow-red-600/20"
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Forever"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}