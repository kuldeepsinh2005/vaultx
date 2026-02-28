import { useAuth } from "../context/AuthContext";
import { useTransfers } from "../context/TransferContext"; // ✅ IMPORT NEW CONTEXT
import { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { CloudUpload, Files, ShieldCheck, Lock, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

const Dashboard = () => {
  const { api } = useAuth();
  const { startGlobalUpload } = useTransfers(); // ✅ HOOK INTO ENGINE
  
  const [fileList, setFileList] = useState([]);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [status, setStatus] = useState({ type: "", text: "" });

  const location = useLocation();
  const currentFolder = location.state?.targetFolder || null;
  const currentFolderName = location.state?.targetFolderName || "Root";

  const handleUploadClick = async () => {
    if (!fileList.length) return;

    try {
      setStatus({ type: "info", text: "Initializing secure vault connection..." });
      
      // Fetch public key just once before handing off to the global engine
      const userRes = await api.get("/auth/me");
      const publicKey = userRes.data.user.publicKey;

      // 🚀 FIRE AND FORGET! The TransferContext handles it from here!
      startGlobalUpload(fileList, currentFolder, publicKey);

      // Immediately reset UI so user can keep working or navigate away
      setFileList([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      
      setStatus({ type: "success", text: "Uploads added to global background queue!" });

      // Clear the success message after 3 seconds
      setTimeout(() => setStatus({ type: "", text: "" }), 3000);

    } catch (err) {
      console.error(err);
      setStatus({ type: "error", text: "Failed to initialize upload." });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 blur-[100px] pointer-events-none" />
        <Header />
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full space-y-6">
  
            {currentFolder && (
              <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 font-medium text-sm flex items-center shadow-sm">
                Uploading into folder: <span className="font-bold ml-1.5 text-blue-900">{currentFolderName}</span>
              </div>
            )}

            <Card className="p-8 border-slate-200 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Secure Encryption</h3>
                </div>
              </div>

              <div className="relative group mb-8">
                <div className="flex gap-3 mb-6">
                  <label htmlFor="file-upload" className="px-4 py-2 bg-white border border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-700 hover:bg-slate-50 transition font-semibold text-sm text-slate-700 shadow-sm">
                    Upload Files
                  </label>
                  <label htmlFor="folder-upload" className="px-4 py-2 bg-white border border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-700 hover:bg-slate-50 transition font-semibold text-sm text-slate-700 shadow-sm">
                    Upload Folder
                  </label>
                </div>

                <input type="file" multiple ref={fileInputRef} onChange={(e) => setFileList([...e.target.files])} className="hidden" id="file-upload" />
                <input type="file" multiple ref={folderInputRef} webkitdirectory="" directory="" onChange={(e) => setFileList([...e.target.files])} className="hidden" id="folder-upload" />

                <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${fileList.length ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-300 group-hover:border-blue-400 bg-slate-50/50'}`}>
                  <div className={`mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center transition-colors shadow-sm ${fileList.length ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200'}`}>
                    <CloudUpload size={28} />
                  </div>
                  {fileList.length ? (
                    <div className="space-y-1">
                      <p className="text-slate-900 font-bold text-base truncate px-4">
                        {fileList.length === 1 ? fileList[0].name : `${fileList.length} items selected`}
                      </p>
                      <p className="text-blue-600 text-sm font-medium">Ready to Seal</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-slate-700 font-semibold text-base">Select files or folders to secure</p>
                      <p className="text-slate-500 text-xs font-medium">Zero-Knowledge Protocol</p>
                    </div>
                  )}
                </div>
              </div>

              {status.text && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border animate-in slide-in-from-bottom-2 shadow-sm ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  status.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  <div className="flex-shrink-0">
                    {status.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : 
                    status.type === 'error' ? <ShieldAlert size={18} className="text-red-500" /> : 
                    <Loader2 size={18} className="animate-spin text-blue-500" />}
                  </div>
                  {status.text}
                </div>
              )}
              
              <div className={status.text ? "" : "mt-8"}>
                <Button 
                  onClick={handleUploadClick}
                  disabled={!fileList.length}  
                  variant="primary"
                >
                  <ShieldCheck size={18} /> Seal & Upload to Vault
                </Button>
              </div>
            </Card>

            <Link to="/files" className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group shadow-sm mt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm">
                  <Files size={24} />
                </div>
                <div>
                  <span className="block font-bold text-slate-900 text-base">Access Vault Assets</span>
                  <span className="text-slate-500 text-sm font-medium">View encrypted payload list</span>
                </div>
              </div>
              <div className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">
                <ArrowRight size={20} />
              </div>
            </Link>

          </div>
        </div>
      </main>
    </div>
  );
};

const ArrowRight = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14m-7-7 7 7-7 7"/>
  </svg>
);

export default Dashboard;