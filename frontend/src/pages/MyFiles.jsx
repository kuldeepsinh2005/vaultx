// frontend/src/pages/MyFiles.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";

import { 
  importAESKey, 
  decryptFile,  
  unwrapAESKeyWithPrivateKey,
} from "../utils/crypto";
import {
  decryptPrivateKey,
} from "../utils/privateKeyBackup";

import { 
  Loader2,
  Lock,
  AlertCircle,
  Database,
  ArrowRight
} from "lucide-react";

// Reusable UI Components
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";



const MyFiles = () => {
  const { api } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decryptingId, setDecryptingId] = useState(null);
  const { privateKey } = useKey();
  const navigate = useNavigate();



  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await api.get("/files/my");
        setFiles(res.data.files || []);
      } catch (err) {
        setError("Unable to retrieve your vault data.");
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [api]);

  const handleDownload = async (file) => {
    try {
      if (!privateKey) {
        navigate("/unlock");
        return;
      }

      setDecryptingId(file._id);

      // 1️⃣ Download encrypted file
      const res = await api.get(
        `/files/download/${file._id}`,
        { responseType: "blob" }
      );

      // 2️⃣ Unwrap AES key
      const aesKey = await unwrapAESKeyWithPrivateKey(
        file.wrappedKey,
        privateKey
      );

      // 3️⃣ Decrypt file
      const decryptedBuffer = await decryptFile(
        res.data,
        aesKey
      );

      // 4️⃣ Download plaintext file
      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Decryption failed");
    } finally {
      setDecryptingId(null);
    }
  };



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
            
            {error ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm">
                <AlertCircle size={20} /> {error}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-[2rem]">
                <Database className="text-slate-700 w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">No files found</h3>
                <p className="text-slate-500 mb-8 text-sm">Your secure storage is currently empty.</p>
                <Link to="/dashboard" className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-500 transition-all inline-flex items-center gap-2">
                  Go to Upload <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              /* THE EXACT TABLE UI YOU REQUESTED */
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden border-slate-800/50 flex flex-col flex-1">
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
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button 
                              onClick={() => handleDownload(file)}
                              disabled={decryptingId === file._id}
                              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border
                              ${decryptingId === file._id 
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' 
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-white hover:text-black hover:border-white shadow-xl hover:shadow-white/5'}`}
                            >
                              {decryptingId === file._id ? (
                                <Loader2 className="w-[14px] h-[14px] animate-spin" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>
                              )}
                              {decryptingId === file._id ? "Decrypting" : "Retrieve"}
                            </button>
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
      </main>
    </div>
  );
};

export default MyFiles;