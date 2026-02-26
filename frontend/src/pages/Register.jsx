// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, ChevronLeft, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { generateKeyPair, exportPublicKey } from "../utils/keypair";
import { encryptPrivateKey } from "../utils/privateKeyBackup";
import { generateRecoveryCode } from "../utils/crypto"; // ✅ Imported Recovery Code Generator

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
  
  const [recoveryCode, setRecoveryCode] = useState(""); // ✅ State to hold the code for Step 3
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
      // 1️⃣ Generate keypair ONCE
      const keyPair = await generateKeyPair();

      // 2️⃣ Export public key
      const publicKey = await exportPublicKey(keyPair.publicKey);

      // 3️⃣ Generate the secure 24-character recovery code
      const newRecoveryCode = generateRecoveryCode();
      setRecoveryCode(newRecoveryCode);

      // 4️⃣ ENCRYPT TWICE: Once with password, once with recovery code
      const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, formData.password);
      const recoveryEncryptedKey = await encryptPrivateKey(keyPair.privateKey, newRecoveryCode);

      // 5️⃣ Verify email + store BOTH encrypted private keys
      const res = await api.post("/auth/verify-email", {
        email: formData.email,
        code: formData.code,
        encryptedPrivateKey, 
        recoveryEncryptedKey, // ✅ Sent to backend
      });

      if (!res.data.success) {
        throw new Error("Verification failed");
      }

      // 6️⃣ Store public key
      await api.post("/keys/public", { publicKey });

      // 7️⃣ Auto-login (but don't navigate away just yet!)
      // await login(formData.email, formData.password, true);

      setMessage("");
      setStep(3); // ✅ Move to Step 3 to show the code

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-0 w-full h-1/2 bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-[440px] z-10">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10">
          <header className="mb-8 text-center md:text-left">
            <h2 className="text-white text-2xl font-bold tracking-tight">
              {step === 1 && "Create Secure Account"}
              {step === 2 && "Identity Verification"}
              {step === 3 && "Emergency Recovery"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {step === 1 && "Start your zero-knowledge storage journey"}
              {step === 2 && "Enter the code sent to your email"}
              {step === 3 && "Crucial step: Save your recovery phrase"}
            </p>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 block"></span>
              {error}
            </div>
          )}

          {message && step !== 3 && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
              {message}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">Username</label>
                <Input type="text" name="username" placeholder="johndoe" icon={User} value={formData.username} onChange={handleChange} />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">Email</label>
                <Input type="email" name="email" placeholder="john@vaultx.com" icon={Mail} value={formData.email} onChange={handleChange} />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">Master Password</label>
                <Input type="password" name="password" placeholder="••••••••" icon={Lock} value={formData.password} onChange={handleChange} />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold ml-1">Confirm Password</label>
                <Input type="password" name="confirmPassword" placeholder="••••••••" icon={Lock} value={formData.confirmPassword} onChange={handleChange} />
              </div>
              
              <Button type="submit" loading={loading}>
                {loading ? "Sending..." : "Send Verification Code"}
                {!loading && <ArrowRight size={18} />}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-6 text-center">
              <div className="space-y-2">
                 <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block">One-Time Security Code</label>
                 <Input
                    type="text"
                    name="code"
                    placeholder="Enter Code"
                    icon={KeyRound}
                    className="text-center"
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
                className="text-slate-500 hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-2 mx-auto"
              >
                <ChevronLeft size={14} /> Back to Details
              </button>
            </form>
          )}

          {/* ✅ NEW STEP 3: RECOVERY CODE DISPLAY */}
          {step === 3 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-amber-400 font-bold text-lg mb-2">Save This Code Immediately</h3>
                <p className="text-slate-300 text-xs mb-6 leading-relaxed">
                  VaultX is Zero-Knowledge. If you forget your password, this code is the <b>ONLY</b> way to recover your account and decrypt your files. We cannot reset it for you.
                </p>
                <div className="bg-slate-950 p-4 rounded-xl font-mono text-lg tracking-widest text-white border border-slate-800 select-all mb-2">
                  {recoveryCode}
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-3">
                  Double click code to copy
                </p>
              </div>

              {/* Change this button inside Step 3 */}
              <Button 
                onClick={async () => {
                  // NOW we log them in and let the context redirect them
                  await login(formData.email, formData.password);
                }} 
                variant="success"
              >
                I have safely stored this code
              </Button>
            </div>
          )}

          {step !== 3 && (
            <div className="mt-8 pt-6 border-t border-slate-800 text-center">
              <p className="text-slate-500 text-sm">
                Already have a vault?{" "}
                <Link to="/login" className="text-indigo-400 font-bold hover:text-white transition-colors underline underline-offset-4 decoration-indigo-500/30">
                  Access Here
                </Link>
              </p>
            </div>
          )}
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Register;