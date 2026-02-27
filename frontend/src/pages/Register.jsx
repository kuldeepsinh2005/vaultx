// frontend/src/pages/Register.jsx
// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, ChevronLeft, ShieldCheck, KeyRound, AlertTriangle, ShieldAlert } from "lucide-react";
import { generateKeyPair, exportPublicKey } from "../utils/keypair";
import { encryptPrivateKey } from "../utils/privateKeyBackup";
import { generateRecoveryCode } from "../utils/crypto";

// Importing the reusable UI elements we created
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Footer } from "../components/layout/Footer";

const Register = () => {
  const { isAuthenticated, api, login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: send code, 2: verify code, 3: show recovery code
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  
  const [recoveryCode, setRecoveryCode] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (isAuthenticated && step !== 3) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!formData.username || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      if (res.data.success) {
        setStep(2);
        setMessage("Verification code sent to your email");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!formData.code) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);

    try {
      const keyPair = await generateKeyPair();
      const publicKey = await exportPublicKey(keyPair.publicKey);
      const newRecoveryCode = generateRecoveryCode();
      
      setRecoveryCode(newRecoveryCode);

      const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, formData.password);
      const recoveryEncryptedKey = await encryptPrivateKey(keyPair.privateKey, newRecoveryCode);

      const res = await api.post("/auth/verify-email", {
        email: formData.email,
        code: formData.code,
        encryptedPrivateKey, 
        recoveryEncryptedKey,
      });

      if (!res.data.success) {
        throw new Error("Verification failed");
      }

      await api.post("/keys/public", { publicKey });

      setMessage("");
      setStep(3); 

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Verification failed");
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
            <h2 className="text-slate-900 text-2xl font-bold tracking-tight">
              {step === 1 && "Create workspace"}
              {step === 2 && "Identity Verification"}
              {step === 3 && "Emergency Recovery"}
            </h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">
              {step === 1 && "Start your zero-knowledge storage journey"}
              {step === 2 && "Enter the code sent to your email"}
              {step === 3 && "Crucial step: Save your recovery phrase"}
            </p>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldAlert size={18} className="text-red-500" />
              {error}
            </div>
          )}

          {message && step !== 3 && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldCheck size={18} className="text-emerald-500" />
              {message}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">Username</label>
                <Input type="text" name="username" placeholder="johndoe" icon={User} value={formData.username} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">Work Email</label>
                <Input type="email" name="email" placeholder="you@company.com" icon={Mail} value={formData.email} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">Master Password</label>
                <Input type="password" name="password" placeholder="••••••••" icon={Lock} value={formData.password} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold ml-1 block">Confirm Password</label>
                <Input type="password" name="confirmPassword" placeholder="••••••••" icon={Lock} value={formData.confirmPassword} onChange={handleChange} />
              </div>
              
              <div className="pt-2">
                <Button type="submit" loading={loading} variant="primary">
                  {loading ? "Sending..." : "Send Verification Code"}
                  {!loading && <ArrowRight size={18} />}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-6 text-center">
              <div className="space-y-2">
                 <label className="text-slate-700 text-sm font-semibold block">One-Time Security Code</label>
                 <Input
                    type="text"
                    name="code"
                    placeholder="Enter Code"
                    icon={KeyRound}
                    className="text-center font-semibold tracking-widest"
                    value={formData.code}
                    onChange={handleChange}
                  />
              </div>
              <Button type="submit" variant="success" loading={loading}>
                {loading ? "Verifying..." : "Verify & Unlock Vault"}
              </Button>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold flex items-center justify-center gap-2 mx-auto mt-2"
              >
                <ChevronLeft size={16} /> Back to Details
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Refined, high-contrast amber box */}
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                <h3 className="text-amber-800 font-bold text-lg mb-2">Save This Code Immediately</h3>
                <p className="text-amber-700 text-sm mb-6 leading-relaxed">
                  VaultX is Zero-Knowledge. If you forget your password, this code is the <b>ONLY</b> way to recover your account and decrypt your files. We cannot reset it for you.
                </p>
                <div className="bg-white p-4 rounded-lg font-mono text-lg tracking-widest text-slate-800 border border-amber-200 select-all mb-2 shadow-inner">
                  {recoveryCode}
                </div>
                <p className="text-xs text-amber-600 font-semibold mt-3">
                  Double click code to copy
                </p>
              </div>

              <Button 
                onClick={async () => {
                  await login(formData.email, formData.password);
                }} 
                variant="success"
              >
                I have safely stored this code
              </Button>
            </div>
          )}

          {step !== 3 && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm font-medium">
                Already have a vault?{" "}
                <Link to="/login" className="text-blue-600 font-semibold ml-1 hover:text-blue-700 transition-colors">
                  Access Here
                </Link>
              </p>
            </div>
          )}
        </Card>
      </main>

      <div className="mt-auto pt-8 text-slate-500">
        <Footer />
      </div>
    </div>
  );
};

export default Register;