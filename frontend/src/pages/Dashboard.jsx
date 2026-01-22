// frontend/src/pages/Dashboard.jsx
import { useAuth } from "../context/AuthContext";
import { generateAESKey, encryptFile, wrapAESKeyWithPublicKey,base64UrlEncode } from "../utils/crypto";
import { useState } from "react";
import { Link,useLocation   } from "react-router-dom";
import { useRef } from "react";

// Icons
import { 
  CloudUpload, 
  Files, 
  ShieldCheck, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert
} from "lucide-react";

// Reusable UI Components
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

const Dashboard = () => {
  const { api } = useAuth();
  // const [file, setFile] = useState(null);
  const [fileList, setFileList] = useState([]);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const location = useLocation();

  const currentFolder =
    location.state?.targetFolder || null;

  const currentFolderName =
    location.state?.targetFolderName || "Root";



  const handleUpload = async () => {
  if (!fileList.length) return;

  setUploading(true);
  setStatus({ type: "info", text: "Encrypting & uploading files..." });

  try {
    const userRes = await api.get("/auth/me");
    const publicKey = userRes.data.user.publicKey;

    for (const file of fileList) {
      // 1️⃣ Generate AES key
      const aesKey = await generateAESKey();

      // 2️⃣ Encrypt file
      const { encryptedBuffer, iv } = await encryptFile(file, aesKey);

      // 3️⃣ Wrap AES key
      const wrappedKey = await wrapAESKeyWithPublicKey(aesKey, publicKey);

      // 4️⃣ Convert IV to Base64
      const ivBase64 = base64UrlEncode(iv);

      // 5️⃣ Encrypted file = ciphertext ONLY
      const encryptedBlob = new Blob([
        new Uint8Array(encryptedBuffer),
      ]);

      const formData = new FormData();
      formData.append("file", encryptedBlob, file.name);
      formData.append("wrappedKey", wrappedKey);
      formData.append("iv", ivBase64);

      formData.append(
        "relativePath",
        file.webkitRelativePath || file.name
      );

      if (currentFolder) {
        formData.append("folder", currentFolder);
      }

      await api.post("/files/upload", formData);
    }

    setStatus({ type: "success", text: "Files uploaded securely!" });
    setFileList([]);
    fileInputRef.current && (fileInputRef.current.value = "");
    folderInputRef.current && (folderInputRef.current.value = "");

  } catch (err) {
    console.error(err);
    setStatus({ type: "error", text: "Encryption or upload failed." });
  } finally {
    setUploading(false);
  }
};


  return (
    /* Changed min-h-screen to h-screen and added overflow-hidden to match MyFiles */
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />
      
      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] pointer-events-none" />

        <Header />
        
        {/* Dashboard Body - Added overflow-y-auto and flex-1 */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full space-y-6">
  
            {currentFolder && (
              <div className="mb-4 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 font-bold text-sm">
                Uploading into folder: <span className="text-white">{currentFolderName}</span>
              </div>
            )}




            {/* Upload Section - Tightened padding (p-8 instead of p-10) */}
            <Card className="p-8 border-indigo-500/10 shadow-indigo-500/5">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-indigo-600/10 text-indigo-500 rounded-xl border border-indigo-500/20 shadow-inner">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Secure Local Encryption</h3>
                  <p className="text-slate-500 text-sm">AES-256-GCM Protection</p>
                </div>
              </div>

            {/* Enhanced File Dropzone - Added mb-8 for space below */}
            <div className="relative group mb-8">

              <div className="flex gap-3 mb-6">
                <label
                  htmlFor="file-upload"
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500 transition"
                >
                  Upload Files
                </label>

                <label
                  htmlFor="folder-upload"
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500 transition"
                >
                  Upload Folder
                </label>
              </div>




              {/* Upload Files */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => setFileList([...e.target.files])}
                className="hidden"
                id="file-upload"
              />

              {/* Upload Folder */}
              <input
                type="file"
                multiple
                ref={folderInputRef}
                webkitdirectory=""
                directory=""
                onChange={(e) => setFileList([...e.target.files])}
                className="hidden"
                id="folder-upload"
              />

              <div
                className={`border-2 border-dashed rounded-[2rem] p-10 text-center transition-all duration-300 
                ${fileList.length 
                  ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_40px_-15px_rgba(79,70,229,0.3)]' 
                  : 'border-slate-800 group-hover:border-slate-700 bg-slate-950/50'}`}
              >

                <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${fileList.length ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-slate-600 group-hover:text-slate-400'}`}>
                  <CloudUpload size={28} />
                </div>
                {fileList.length ? (
                    <div className="space-y-1">
                      <p className="text-white font-bold text-base truncate px-4">
                        {fileList.length === 1
                          ? fileList[0].name
                          : `${fileList.length} items selected`}
                      </p>
                      <p className="text-indigo-400/60 text-xs uppercase tracking-widest font-bold">
                        Ready to Seal
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-1">
                    <p className="text-slate-300 font-bold text-base">Select files or folders to secure</p>
                    <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">Zero-Knowledge Protocol</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Notifications - Increased mt-8 and py-5 for a larger 'alert' box feel */}
            {status.text && (
              <div className={`mt-8 mb-8 p-5 rounded-2xl flex items-center gap-4 text-sm font-bold border animate-in slide-in-from-bottom-2 ${
                status.type === 'success' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 
                status.type === 'error' ? 'bg-red-500/5 text-red-400 border-red-500/20' : 
                'bg-indigo-500/5 text-indigo-400 border-indigo-500/20'
              }`}>
                <div className="flex-shrink-0">
                  {status.type === 'success' ? <CheckCircle2 size={18} /> : 
                  status.type === 'error' ? <ShieldAlert size={18} /> : 
                  <Loader2 size={18} className="animate-spin" />}
                </div>
                {status.text}
              </div>
            )}

            {/* Upload Button - Increased mt-10 if no status exists, otherwise status mb handles it */}
            <Button 
              onClick={handleUpload}
              disabled={!fileList.length || uploading}  
              loading={uploading}
              className={status.text ? "" : "mt-10"} 
            >
              {!uploading && <ShieldCheck size={18} />}
              {uploading ? "Executing..." : "Seal & Upload to Vault"}
            </Button>
            </Card>

            {/* Quick Navigation Card - Dimensions synchronized */}
            <Link to="/files" className="p-6 bg-slate-950/50 border border-slate-800 rounded-[2rem] hover:border-indigo-500/50 transition-all flex items-center justify-between group shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 text-slate-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Files size={24} />
                </div>
                <div>
                  <span className="block font-bold text-white text-base">Access Vault Assets</span>
                  <span className="text-slate-500 text-xs">View encrypted payload list</span>
                </div>
              </div>
              <div className="text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14m-7-7 7 7-7 7"/>
  </svg>
);

export default Dashboard;