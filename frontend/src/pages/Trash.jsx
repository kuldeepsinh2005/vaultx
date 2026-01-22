import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

const TrashFolderNode = ({ folder, refreshTrash, setConfirmDelete }) => {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const restoreFile = async (fileId) => {
    await api.patch(`/trash/file/${fileId}/restore`);
    refreshTrash();
  };

  const deleteFileForever = async (fileId) => {
    await api.delete(`/trash/file/${fileId}`);
    refreshTrash();
  };


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
              className="text-emerald-400"
              onClick={async () => {
                await api.patch(`/trash/folder/${folder._id}/restore`);
                refreshTrash();
              }}
            >
              Restore
            </button>

            <button
              className="text-red-400"
              onClick={async () => {
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
              className="flex justify-between items-center bg-slate-900 p-2 rounded mb-1"
            >
              📄 {file.originalName}

              {/* ❌ NO BUTTONS for nested files */}
            </div>
          ))}

          {/* Child folders */}
          {folder.children?.map(child => (
            <TrashFolderNode
              key={child._id}
              folder={child}
              refreshTrash={refreshTrash}
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
  /*
  confirmDelete = {
    type: "file" | "folder",
    id: string,
    name: string
  }
  */


  const refreshTrash = async () => {
    const res = await api.get("/trash");
    setTrash(res.data);
 };


  useEffect(() => {
    refreshTrash();
  }, []);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Trash</h2>

          <h3 className="text-sm text-slate-400 mb-2">Folders</h3>
          {trash.folders.length === 0 && (
            <p className="text-slate-600 text-sm">No folders in trash</p>
          )}

         {trash.folders?.map(folder => (
        <TrashFolderNode
            key={folder._id}
            folder={folder}
            refreshTrash={refreshTrash}
            setConfirmDelete={setConfirmDelete}

        />
        ))}
        {trash.files?.map(file => (
                  <div
                    key={file._id}
                    className="flex justify-between items-center bg-slate-900 p-2 rounded mb-2"
                  >
                    📄 {file.originalName}
                    <div className="flex gap-2 text-xs">
                      <button
                        className="text-emerald-400"
                        onClick={async () => {
                          await api.patch(`/trash/file/${file._id}/restore`);
                          refreshTrash();
                        }}
                      >
                        Restore
                      </button>

                      <button
                        className="text-red-400"
                        onClick={async () => {
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
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-96 border border-slate-700">
            <h3 className="text-red-400 font-bold text-lg mb-2">
              Permanently delete {confirmDelete.type}?
            </h3>

            <p className="text-sm text-slate-400 mb-4">
              <strong className="text-white">{confirmDelete.name}</strong>
              <br />
              This action <span className="text-red-400">cannot be undone</span>.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-slate-700 rounded text-sm"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (confirmDelete.type === "file") {
                    await api.delete(`/trash/file/${confirmDelete.id}`);
                  } else {
                    await api.delete(`/trash/folder/${confirmDelete.id}`);
                  }

                  setConfirmDelete(null);
                  refreshTrash();
                }}
                className="px-4 py-2 bg-red-600 rounded font-bold text-sm"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
