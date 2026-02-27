// frontend/src/pages/Dashboard.jsx
// frontend/src/pages/Dashboard.jsx
import { useAuth } from "../context/AuthContext";
import { generateAESKey, encryptFile, wrapAESKeyWithPublicKey,base64UrlEncode } from "../utils/crypto";
import { useState } from "react";
import { Link,useLocation   } from "react-router-dom";
import { useRef } from "react";
import axios from "axios";
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
import { runCryptoWorker } from "../utils/workerHelper";

const Dashboard = () => {
  const { api } = useAuth();
  const [fileList, setFileList] = useState([]);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [progress, setProgress] = useState(0);

  const location = useLocation();

  const currentFolder = location.state?.targetFolder || null;
  const currentFolderName = location.state?.targetFolderName || "Root";

  const handleUpload = async () => {
    if (!fileList.length) return;

    setUploading(true);
    setStatus({ type: "info", text: "Initializing..." });

    // AWS Multipart Setup
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const MAX_CONCURRENT_UPLOADS = 4; // Upload 4 chunks simultaneously

    try {
      // Fetch user's public key for wrapping the AES key
      const userRes = await api.get("/auth/me");
      const publicKey = userRes.data.user.publicKey;

      for (const file of fileList) {
        // Variables scoped outside so the catch block can access them for rollback
        let currentUploadId = null;
        let currentStoragePath = null;

        try {
          setProgress(0);
          setStatus({ type: "info", text: `Encrypting ${file.name} locally (this may take a minute)...` });

          // 🚀 PHASE 1: BACKGROUND ENCRYPTION
          const { encryptedBuffer, exportedKey, iv } = await runCryptoWorker("ENCRYPT", { file });

          const importedAesKey = await crypto.subtle.importKey("raw", exportedKey, "AES-GCM", true, ["encrypt", "decrypt"]);
          const wrappedKey = await wrapAESKeyWithPublicKey(importedAesKey, publicKey);
          const ivBase64 = base64UrlEncode(iv);
          
          const encryptedBlob = new Blob([new Uint8Array(encryptedBuffer)], { type: "application/octet-stream" });
          const partsCount = Math.ceil(encryptedBlob.size / CHUNK_SIZE);

          // 🚀 PHASE 2: INITIATE MULTIPART UPLOAD
          setStatus({ type: "info", text: `Connecting to secure vault...` });
          const initRes = await api.post("/files/multipart/initiate", {
            fileSize: encryptedBlob.size,
            partsCount
          });
          
          currentUploadId = initRes.data.uploadId;
          currentStoragePath = initRes.data.storagePath;
          const { urls } = initRes.data;

          // 🚀 PHASE 3: PARALLEL CHUNK UPLOAD (Sliding Window - No Rigid Batches!)
          setStatus({ type: "info", text: `Uploading ${file.name}...` });
          const uploadedParts = [];
          const chunkProgress = {}; 
          let lastUiUpdate = 0;

          const activeUploads = new Set(); // Tracks ongoing uploads

          for (const part of urls) {
            const start = (part.partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, encryptedBlob.size);
            const chunk = encryptedBlob.slice(start, end);

            // Create the upload promise
            const uploadPromise = axios.put(part.url, chunk, {
              headers: { "Content-Type": "application/octet-stream" },
              onUploadProgress: (progressEvent) => {
                chunkProgress[part.partNumber] = progressEvent.loaded;
                
                const now = Date.now();
                // Update UI smoothly without freezing React
                if (now - lastUiUpdate > 150 || progressEvent.loaded === progressEvent.total) {
                  const currentTotal = Object.values(chunkProgress).reduce((sum, val) => sum + val, 0);
                  setProgress(Math.round((currentTotal / encryptedBlob.size) * 100));
                  lastUiUpdate = now;
                }
              }
            }).then((res) => {
              // When finished, save the ETag and remove from active queue
              uploadedParts.push({ PartNumber: part.partNumber, ETag: res.headers.etag });
              activeUploads.delete(uploadPromise);
            });

            activeUploads.add(uploadPromise);

            // ✅ SLIDING WINDOW: If we hit 4 connections, wait for just ONE to finish before starting the next
            if (activeUploads.size >= MAX_CONCURRENT_UPLOADS) {
              await Promise.race(activeUploads);
            }
          }

          // Wait for the final few chunks to finish
          await Promise.all(activeUploads);

          // 🚀 PHASE 4: STITCH FILE & FINALIZE MONGODB
          setStatus({ type: "info", text: `Finalizing ${file.name}...` });
          setProgress(100);
          
          uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

          await api.post("/files/multipart/complete", {
            uploadId: currentUploadId,
            storagePath: currentStoragePath,
            parts: uploadedParts,
            originalName: file.name,
            wrappedKey: wrappedKey,
            iv: ivBase64,
            size: encryptedBlob.size,
            mimeType: file.type || "application/octet-stream",
            folderId: currentFolder || null,
            relativePath: file.webkitRelativePath || file.name 
          });

        } catch (fileErr) {
          console.error(`🚨 Upload crashed for ${file.name}:`, fileErr);
          
          // 🚨 STATE CONSISTENCY: Abort and clean up AWS S3
          if (currentUploadId && currentStoragePath) {
            await api.post("/files/multipart/abort", {
              uploadId: currentUploadId,
              storagePath: currentStoragePath
            }).catch(e => console.error("Failed to abort S3 upload:", e));
          }
          
          setStatus({ type: "error", text: `Failed to upload ${file.name}` });
          await new Promise(resolve => setTimeout(resolve, 2000)); 
        }
      }

      // Cleanup and success state
      setStatus({ type: "success", text: "All files secured successfully!" });
      setFileList([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";

      // ✅ FIX: Reload the page to show the new files instead of crashing on fetchFiles
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("🚨 Upload crashed:", err);
      setStatus({ 
        type: "error", 
        text: err.response?.data?.error || "Upload failed. Check console for details." 
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  
  return (
    // Clean, crisp enterprise light mode background
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />
      
      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Subtle, professional background depth */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 blur-[100px] pointer-events-none" />

        <Header />
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full space-y-6">
  
            {currentFolder && (
              <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 font-medium text-sm flex items-center shadow-sm">
                Uploading into folder: <span className="font-bold ml-1.5 text-blue-900">{currentFolderName}</span>
              </div>
            )}

            {/* Upload Section Card */}
            <Card className="p-8 border-slate-200 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Secure Encryption</h3>
                  {/* <p className="text-slate-500 text-sm font-medium">AES-256-GCM Protection</p> */}
                </div>
              </div>

            {/* Enhanced File Dropzone */}
            <div className="relative group mb-8">

              <div className="flex gap-3 mb-6">
                <label
                  htmlFor="file-upload"
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-700 hover:bg-slate-50 transition font-semibold text-sm text-slate-700 shadow-sm"
                >
                  Upload Files
                </label>

                <label
                  htmlFor="folder-upload"
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-700 hover:bg-slate-50 transition font-semibold text-sm text-slate-700 shadow-sm"
                >
                  Upload Folder
                </label>
              </div>

              {/* Upload Files Input */}
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => setFileList([...e.target.files])}
                className="hidden"
                id="file-upload"
              />

              {/* Upload Folder Input */}
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
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 
                ${fileList.length 
                  ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                  : 'border-slate-300 group-hover:border-blue-400 bg-slate-50/50'}`}
              >

                <div className={`mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center transition-colors shadow-sm ${fileList.length ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200'}`}>
                  <CloudUpload size={28} />
                </div>
                {fileList.length ? (
                    <div className="space-y-1">
                      <p className="text-slate-900 font-bold text-base truncate px-4">
                        {fileList.length === 1
                          ? fileList[0].name
                          : `${fileList.length} items selected`}
                      </p>
                      <p className="text-blue-600 text-sm font-medium">
                        Ready to Seal
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-1.5">
                    <p className="text-slate-700 font-semibold text-base">Select files or folders to secure</p>
                    <p className="text-slate-500 text-xs font-medium">Zero-Knowledge Protocol</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Notifications */}
            {status.text && (
              <div className={`mt-8 mb-8 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border animate-in slide-in-from-bottom-2 shadow-sm ${
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
            
            {/* Dynamic Progress Bar UI */}
            {uploading && (
              <div className="mb-6 animate-in fade-in duration-300">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2.5">
                  <span className="text-slate-700">{status.text}</span>
                  <div className="flex items-center gap-2">
                    {progress > 0 && progress < 100 && <span className="text-blue-600 font-bold">{progress}%</span>}
                    {progress === 100 && <span className="text-emerald-600 font-bold animate-pulse">Wait...</span>}
                  </div>
                </div>
                
                <div className="w-full bg-slate-100 border border-slate-200 rounded-full h-3 overflow-hidden shadow-inner relative">
                  
                  {/* Phase 1: Encrypting (Pulsing background when progress is 0) */}
                  {progress === 0 && (
                    <div className="absolute inset-0 bg-blue-200 animate-pulse" />
                  )}

                  {/* Phase 2 & 3: Uploading & Finalizing */}
                  {progress > 0 && (
                    <div 
                      className={`h-full transition-all duration-300 ease-out relative ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    >
                      {/* Shimmer effect inside the bar */}
                      <div className="absolute top-0 right-0 bottom-0 w-10 bg-white/30 blur-[4px] -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Existing Upload Button */}
            <div className={status.text ? "" : "mt-8"}>
              <Button 
                onClick={handleUpload}
                disabled={!fileList.length || uploading}  
                loading={uploading}
                variant="primary"
              >
                {!uploading && <ShieldCheck size={18} />}
                {uploading ? (progress > 0 ? `Sealing... ${progress}%` : "Encrypting Locally...") : "Seal & Upload to Vault"}
              </Button>
            </div>
            </Card>

            {/* Quick Navigation Card */}
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