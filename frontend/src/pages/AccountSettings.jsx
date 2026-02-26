import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { decryptPrivateKey, encryptPrivateKey } from "../utils/privateKeyBackup";
import { generateRecoveryCode } from "../utils/crypto";
import { AlertTriangle, Copy, CheckCircle } from "lucide-react";

export default function AccountSettings() {
  const { api, user } = useAuth();

  // Username
  const [username, setUsername] = useState(user?.username || "");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Recovery Code
  const [verifyPassword, setVerifyPassword] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState("");
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateUsername = async () => {
    setUsernameMsg("");
    if (!username.trim() || username === user.username) return;
    try {
      setUsernameLoading(true);
      await api.patch("/account/username", { username });
      setUsernameMsg("Username updated successfully ✅");
    } catch (err) {
      setUsernameMsg("Failed to update username ❌");
    } finally {
      setUsernameLoading(false);
    }
  };

  const updatePassword = async () => {
    setPasswordMsg("");
    if (!oldPassword || !newPassword || oldPassword === newPassword) {
      setPasswordMsg("Valid, differing passwords are required.");
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

      setPasswordMsg("Password changed successfully ✅");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMsg("Incorrect old password or update failed ❌");
    } finally {
      setPasswordLoading(false);
    }
  };

  const regenerateRecoveryCode = async () => {
    setRecoveryMsg("");
    if (!verifyPassword) {
      setRecoveryMsg("Password required to generate a new code.");
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
      setRecoveryMsg("Old code invalidated. New code generated ✅");
    } catch (err) {
      setRecoveryMsg("Incorrect password ❌");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newRecoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 space-y-8">
      <h1 className="text-3xl font-bold text-slate-800">Account Settings</h1>

      {/* Username */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Change Username</h2>
        <input
          className="w-full border rounded-lg px-4 py-3 mb-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={updateUsername} disabled={usernameLoading} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
          {usernameLoading ? "Updating..." : "Update Username"}
        </button>
        {usernameMsg && <p className="mt-3 text-sm font-medium text-slate-600">{usernameMsg}</p>}
      </div>

      {/* Password */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Change Password</h2>
        <input
          type="password" placeholder="Current Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-4 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button onClick={updatePassword} disabled={passwordLoading} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 transition">
          {passwordLoading ? "Processing..." : "Update Password"}
        </button>
        {passwordMsg && <p className="mt-3 text-sm font-medium text-slate-600">{passwordMsg}</p>}
      </div>

      {/* Regenerate Recovery Code */}
      <div className="bg-white p-6 rounded-xl shadow border border-red-100">
        <h2 className="text-xl font-semibold mb-2 text-slate-800">Regenerate Recovery Code</h2>
        <p className="text-sm text-slate-500 mb-5">
          Lost your paper backup? Enter your current password to generate a new emergency recovery code. This will permanently invalidate your old code.
        </p>

        {!newRecoveryCode ? (
          <>
            <input
              type="password" placeholder="Enter current password to authorize" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mb-4 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
            <button onClick={regenerateRecoveryCode} disabled={recoveryLoading} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50 transition">
              {recoveryLoading ? "Generating..." : "Generate New Code"}
            </button>
          </>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <h3 className="text-amber-800 font-bold mb-2">New Recovery Code Generated</h3>
            <p className="text-amber-700 text-sm mb-4">Write this down immediately. You will not be able to see it again after leaving this page.</p>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white p-4 rounded-lg font-mono text-lg tracking-widest text-slate-800 border border-amber-200 select-all">
                {newRecoveryCode}
              </div>
              <button onClick={copyCode} className="p-4 bg-white border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-100 transition">
                {copied ? <CheckCircle size={24} /> : <Copy size={24} />}
              </button>
            </div>
          </div>
        )}
        {recoveryMsg && <p className="mt-3 text-sm font-medium text-slate-600">{recoveryMsg}</p>}
      </div>
    </div>
  );
}