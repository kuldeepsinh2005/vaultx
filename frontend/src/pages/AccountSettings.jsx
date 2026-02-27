// frontend/src/pages/AccountSettings.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { decryptPrivateKey, encryptPrivateKey } from "../utils/privateKeyBackup";
import { generateRecoveryCode } from "../utils/crypto";
import { AlertTriangle, Copy, CheckCircle, User, KeyRound, ShieldAlert, Loader2, Settings } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

export default function AccountSettings() {
  const { api, user } = useAuth();

  // Username
  const [username, setUsername] = useState(user?.username || "");
  const [usernameMsg, setUsernameMsg] = useState({ type: "", text: "" });
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Recovery Code
  const [verifyPassword, setVerifyPassword] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState("");
  const [recoveryMsg, setRecoveryMsg] = useState({ type: "", text: "" });
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateUsername = async () => {
    setUsernameMsg({ type: "", text: "" });
    if (!username.trim() || username === user.username) return;
    try {
      setUsernameLoading(true);
      await api.patch("/account/username", { username });
      setUsernameMsg({ type: "success", text: "Username updated successfully." });
    } catch (err) {
      setUsernameMsg({ type: "error", text: "Failed to update username." });
    } finally {
      setUsernameLoading(false);
    }
  };

  const updatePassword = async () => {
    setPasswordMsg({ type: "", text: "" });
    if (!oldPassword || !newPassword || oldPassword === newPassword) {
      setPasswordMsg({ type: "error", text: "Valid, differing passwords are required." });
      return;
    }

    try {
      setPasswordLoading(true);
      // 1. Decrypt with old password
      const privateKey = await decryptPrivateKey(user.encryptedPrivateKey, oldPassword);
      // 2. Encrypt with new password
      const newEncryptedPrivateKey = await encryptPrivateKey(privateKey, newPassword);
      // 3. Atomic update
      await api.patch("/account/password", {
        oldPassword,
        newPassword,
        encryptedPrivateKey: newEncryptedPrivateKey,
      });

      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMsg({ type: "error", text: "Incorrect old password or update failed." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const regenerateRecoveryCode = async () => {
    setRecoveryMsg({ type: "", text: "" });
    if (!verifyPassword) {
      setRecoveryMsg({ type: "error", text: "Password required to generate a new code." });
      return;
    }

    try {
      setRecoveryLoading(true);
      // 1. Unlock private key using current password
      const privateKey = await decryptPrivateKey(user.encryptedPrivateKey, verifyPassword);
      
      // 2. Generate new code and encrypt
      const code = generateRecoveryCode();
      const recoveryEncryptedKey = await encryptPrivateKey(privateKey, code);

      // 3. Save to backend
      await api.patch("/account/recovery-key", { recoveryEncryptedKey });

      setNewRecoveryCode(code);
      setVerifyPassword("");
      setRecoveryMsg({ type: "success", text: "Old code invalidated. New code generated." });
    } catch (err) {
      setRecoveryMsg({ type: "error", text: "Incorrect password." });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newRecoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper for alert styles
  const alertStyle = (type) => 
    type === "success" 
      ? "bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm font-medium shadow-sm flex items-center gap-2 mt-4" 
      : "bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-medium shadow-sm flex items-center gap-2 mt-4";

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 relative">
        <Header />

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Page Header */}
            <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                  <Settings size={20} />
               </div>
               <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
            </div>

            {/* Username Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Profile Details</h2>
                  <p className="text-slate-500 text-sm font-medium">Update your public workspace identifier</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <input
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-[3px] focus:ring-blue-600/10 transition-all shadow-sm font-semibold"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
                <button 
                  onClick={updateUsername} 
                  disabled={usernameLoading} 
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                >
                  {usernameLoading ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : "Update Username"}
                </button>
                {usernameMsg.text && (
                  <div className={alertStyle(usernameMsg.type)}>
                    {usernameMsg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {usernameMsg.text}
                  </div>
                )}
              </div>
            </div>

            {/* Password Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-sm">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Security Credentials</h2>
                  <p className="text-slate-500 text-sm font-medium">Update your master vault password</p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  type="password" 
                  placeholder="Current Master Password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-[3px] focus:ring-blue-600/10 transition-all shadow-sm font-semibold"
                />
                <input
                  type="password" 
                  placeholder="New Master Password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-[3px] focus:ring-blue-600/10 transition-all shadow-sm font-semibold"
                />
                <button 
                  onClick={updatePassword} 
                  disabled={passwordLoading} 
                  className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                >
                  {passwordLoading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Update Password"}
                </button>
                {passwordMsg.text && (
                  <div className={alertStyle(passwordMsg.type)}>
                    {passwordMsg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {passwordMsg.text}
                  </div>
                )}
              </div>
            </div>

            {/* Regenerate Recovery Code Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden">
              {/* Subtle danger background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 blur-[80px] pointer-events-none rounded-full -mr-20 -mt-20" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 shadow-sm">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Emergency Recovery Code</h2>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed max-w-2xl">
                  Lost your paper backup? Enter your current password to generate a new emergency recovery code. <span className="font-bold text-red-600">This will permanently invalidate your old code.</span>
                </p>

                {!newRecoveryCode ? (
                  <div className="space-y-4">
                    <input
                      type="password" 
                      placeholder="Enter current password to authorize" 
                      value={verifyPassword} 
                      onChange={(e) => setVerifyPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:bg-white focus:ring-[3px] focus:ring-red-500/10 transition-all shadow-sm font-semibold"
                    />
                    <button 
                      onClick={regenerateRecoveryCode} 
                      disabled={recoveryLoading} 
                      className="bg-red-50 text-red-600 border border-red-200 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
                    >
                      {recoveryLoading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : "Generate New Code"}
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-inner">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                      <h3 className="text-amber-900 font-bold text-lg tracking-tight">New Recovery Code Generated</h3>
                    </div>
                    <p className="text-amber-800 text-sm font-medium mb-5">
                      Write this down immediately. You will not be able to see it again after leaving this page.
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white p-4 rounded-xl font-mono text-lg tracking-widest font-semibold text-slate-800 border border-amber-200 shadow-sm select-all">
                        {newRecoveryCode}
                      </div>
                      <button 
                        onClick={copyCode} 
                        className="p-4 bg-white border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors shadow-sm"
                        title="Copy to clipboard"
                      >
                        {copied ? <CheckCircle size={22} /> : <Copy size={22} />}
                      </button>
                    </div>
                  </div>
                )}
                
                {recoveryMsg.text && (
                  <div className={alertStyle(recoveryMsg.type)}>
                    {recoveryMsg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {recoveryMsg.text}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}