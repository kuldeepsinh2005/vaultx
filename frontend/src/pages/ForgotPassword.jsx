// frontend/src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { decryptPrivateKey, encryptPrivateKey } from "../utils/privateKeyBackup";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Footer } from "../components/layout/Footer"; // ✅ Added Footer for consistency
import { Mail, Lock, KeyRound, ChevronLeft, ShieldAlert, ShieldCheck } from "lucide-react"; // ✅ Added Shield icons

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Professional subtle blue gradient background accents */}
      <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-blue-100/50 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-slate-200/50 blur-[100px] rounded-full pointer-events-none" />

      <main className="w-full max-w-[420px] z-10">
        <div className="flex justify-center mb-8 text-slate-900">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10">
          <header className="mb-8 text-center md:text-left">
            <h2 className="text-slate-900 text-2xl font-bold tracking-tight">Account Recovery</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">
              {step === 1 ? "Enter your email to find your vault." : "Enter your emergency recovery code."}
            </p>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldAlert size={18} className="text-red-500" />
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldCheck size={18} className="text-emerald-500" />
              {message}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleFetchKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">Work Email</label>
                <Input type="email" placeholder="you@company.com" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="pt-2">
                <Button type="submit" loading={loading} variant="primary">
                  {loading ? "Searching..." : "Find Account"}
                </Button>
              </div>
              <Link to="/login" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold flex items-center justify-center gap-2 mt-4">
                <ChevronLeft size={16} /> Back to Login
              </Link>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">24-Character Recovery Code</label>
                <Input type="text" placeholder="VX-XXXX-XXXX-XXXX-XXXX" icon={KeyRound} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} required className="uppercase font-mono text-sm tracking-widest" />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">New Master Password</label>
                <Input type="password" placeholder="••••••••" icon={Lock} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="pt-2">
                <Button type="submit" variant="success" loading={loading}>
                  {loading ? "Decrypting & Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </main>

      {/* Footer added to match Login/Register pages perfectly */}
      <div className="mt-auto pt-8 text-slate-500">
        <Footer />
      </div>
    </div>
  );
}