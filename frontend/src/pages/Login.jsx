import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Mail, LockKeyhole, LogIn, ShieldAlert } from "lucide-react";

// Importing the reusable UI elements
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Footer } from "../components/layout/Footer";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // Added for button state

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // UI feedback

    const success = await login(email, password, true);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-[400px] z-10">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10">
          <header className="mb-8">
            <h2 className="text-white text-2xl font-bold tracking-tight">Access Vault</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">Unlock your encrypted data</p>
          </header>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in fade-in duration-300">
              <ShieldAlert size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold ml-1">
                Security Email
              </label>
              <Input
                type="email"
                placeholder="identity@vaultx.com"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">
                  Passphrase
                </label>
                {/* ✅ CHANGED FROM BUTTON TO LINK */}
                <Link 
                  to="/forgot-password" 
                  className="text-[10px] text-indigo-400 hover:text-white font-bold transition-colors uppercase tracking-widest"
                >
                  Reset
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                icon={LockKeyhole}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" loading={loading}>
              {!loading && <LogIn size={18} className="mr-1" />}
              {loading ? "Decrypting..." : "Unlock Vault"}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-800/60 text-center">
            <p className="text-slate-500 text-sm font-medium">
              New to VaultX? 
              <Link to="/register" className="text-indigo-400 font-bold ml-2 hover:text-white transition-colors underline underline-offset-8 decoration-indigo-500/30">
                Register Device
              </Link>
            </p>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Login;