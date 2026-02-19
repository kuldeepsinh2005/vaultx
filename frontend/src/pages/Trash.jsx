// frontend/src/pages/Trash.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { Loader2 } from "lucide-react";

const TrashFolderNode = ({ folder, refreshTrash, setConfirmDelete }) => {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-4 border-l border-slate-700 pl-3 mt-2">
      <div className="flex justify-between items-center">
        <div
          className="cursor-pointer font-bold text-indigo-400"
          onClick={() => setOpen(!open)}
        >
          {open ? "📂" : "📁"} {folder.name}
        </div>

        {folder.isRoot && (
          <div className="flex gap-2 text-xs">
            <button
              className="text-emerald-400 hover:text-emerald-300"
              onClick={async () => {
                await api.patch(`/trash/folder/${folder._id}/restore`);
                refreshTrash();
              }}
            >
              Restore
            </button>

            <button
              className="text-red-400 hover:text-red-300"
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
        <div className="ml-4">
          {/* Files inside this folder */}
          {folder.files?.map(file => (
            <div
              key={file._id}
              className="flex justify-between items-center bg-slate-900 p-2 rounded mb-1 text-sm"
            >
              <div className="flex items-center gap-2 text-slate-300">
                📄 {file.originalName}
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
  
  // ✅ ADDED: State to track if deletion is currently in progress
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

  // ✅ ADDED: Extracted delete logic to handle loading state securely
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
      setConfirmDelete(null); // Close modal on success
    } catch (err) {
      console.error("Failed to permanently delete:", err);
      alert("Error deleting item. Please try again.");
    } finally {
      setIsDeleting(false); // Stop loading regardless of success/fail
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Trash</h2>

          <h3 className="text-sm text-slate-400 mb-2">Folders</h3>
          {trash.folders.length === 0 && (
            <p className="text-slate-600 text-sm mb-6">No folders in trash</p>
          )}

          {trash.folders?.map(folder => (
            <TrashFolderNode
              key={folder._id}
              folder={folder}
              refreshTrash={refreshTrash}
              setConfirmDelete={setConfirmDelete}
            />
          ))}

          <h3 className="text-sm text-slate-400 mt-6 mb-2">Loose Files</h3>
          {trash.files.length === 0 && (
            <p className="text-slate-600 text-sm">No files in trash</p>
          )}

          {trash.files?.map(file => (
            <div
              key={file._id}
              className="flex justify-between items-center bg-slate-900 p-2 rounded mb-2 text-sm"
            >
              <div className="flex items-center gap-2 text-slate-300">
                📄 {file.originalName}
              </div>
              
              <div className="flex gap-2 text-xs">
                <button
                  className="text-emerald-400 hover:text-emerald-300 transition"
                  onClick={async () => {
                    await api.patch(`/trash/file/${file._id}/restore`);
                    refreshTrash();
                  }}
                >
                  Restore
                </button>

                <button
                  className="text-red-400 hover:text-red-300 transition"
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
      </main>

      {/* MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-96 border border-slate-700 shadow-2xl">
            <h3 className="text-red-400 font-bold text-lg mb-2">
              Permanently delete {confirmDelete.type}?
            </h3>

            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              <strong className="text-white">{confirmDelete.name}</strong>
              <br />
              This action <span className="text-red-400">cannot be undone</span>.
            </p>

            <div className="flex justify-end gap-3">
              {/* ✅ Cancel Button disabled during load */}
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 disabled:opacity-50 transition"
              >
                Cancel
              </button>

              {/* ✅ Delete Button uses handlePermanentDelete and shows Loader */}
              <button
                onClick={handlePermanentDelete}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                  isDeleting 
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed" 
                    : "bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]"
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