import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { decryptPrivateKey, encryptPrivateKey } from "../utils/privateKeyBackup";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Mail, Lock, KeyRound, ChevronLeft } from "lucide-react";

export default function ForgotPassword() {
  const { api } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [encryptedRecoveryKey, setEncryptedRecoveryKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleFetchKey = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/recovery-key", { email });
      setEncryptedRecoveryKey(res.data.recoveryEncryptedKey);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Account not found or no recovery key set.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Decrypt using the Recovery Code they wrote down
      const privateKey = await decryptPrivateKey(encryptedRecoveryKey, recoveryCode.trim());

      // 2. Re-encrypt using their brand NEW password
      const newEncryptedPrivateKey = await encryptPrivateKey(privateKey, newPassword);

      // 3. Send to backend
      await api.post("/auth/reset-password", {
        email,
        newPassword,
        newEncryptedPrivateKey
      });

      setMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 3000);

    } catch (err) {
      console.error(err);
      setError("Invalid Recovery Code. Please check your backup and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-0 w-full h-1/2 bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-[440px] z-10">
        <div className="flex justify-center mb-10"><Logo size="lg" /></div>

        <Card className="p-8 md:p-10">
          <header className="mb-8 text-center md:text-left">
            <h2 className="text-white text-2xl font-bold tracking-tight">Account Recovery</h2>
            <p className="text-slate-500 text-sm mt-1">
              {step === 1 ? "Enter your email to find your vault." : "Enter your emergency recovery code."}
            </p>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 block"></span>{error}
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>{message}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleFetchKey} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">Email</label>
                <Input type="email" placeholder="john@vaultx.com" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" loading={loading}>{loading ? "Searching..." : "Find Account"}</Button>
              <Link to="/login" className="text-slate-500 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2 mt-4">
                <ChevronLeft size={14} /> Back to Login
              </Link>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">24-Character Recovery Code</label>
                <Input type="text" placeholder="VX-XXXX-XXXX-XXXX-XXXX" icon={KeyRound} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} required className="uppercase font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">New Master Password</label>
                <Input type="password" placeholder="••••••••" icon={Lock} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <Button type="submit" variant="success" loading={loading}>{loading ? "Decrypting & Resetting..." : "Reset Password"}</Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}