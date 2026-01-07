// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, ChevronLeft, ShieldCheck, KeyRound } from "lucide-react";
import { generateKeyPair, exportPublicKey } from "../utils/keypair";
import { encryptPrivateKey } from "../utils/privateKeyBackup";

// Importing the reusable UI elements we created
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Footer } from "../components/layout/Footer";

const Register = () => {
  const { isAuthenticated, api, login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // Step 1: send code, Step 2: verify code
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // --- LOGIC START (Original Handlers) ---
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

      // 3️⃣ Encrypt private key with password
      const encryptedPrivateKey = await encryptPrivateKey(
        keyPair.privateKey,
        formData.password
      );

      // 4️⃣ Download backup (recovery only)
      const blob = new Blob(
        [JSON.stringify(encryptedPrivateKey, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vaultx-private-key-backup.json";
      a.click();
      URL.revokeObjectURL(url);

      // 5️⃣ Verify email + store encrypted private key
      const res = await api.post("/auth/verify-email", {
        email: formData.email,
        code: formData.code,
        encryptedPrivateKey,
      });

      if (!res.data.success) {
        throw new Error("Verification failed");
      }

      // 6️⃣ Store public key
      await api.post("/keys/public", { publicKey });

      // 7️⃣ Auto-login
      await login(formData.email, formData.password,true);

      setMessage("Account created successfully 🔐");
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  };


  
  // --- LOGIC END ---

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative">
      {/* Background decoration */}
      <div className="absolute top-0 w-full h-1/2 bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-[440px] z-10">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10">
          <header className="mb-8 text-center md:text-left">
            <h2 className="text-white text-2xl font-bold tracking-tight">
              {step === 1 ? "Create Secure Account" : "Identity Verification"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {step === 1 ? "Start your zero-knowledge storage journey" : "Enter the code sent to your email"}
            </p>
          </header>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 block"></span>
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
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

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm">
              Already have a vault?{" "}
              <Link to="/login" className="text-indigo-400 font-bold hover:text-white transition-colors underline underline-offset-4 decoration-indigo-500/30">
                Access Here
              </Link>
            </p>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Register;