// frontend/src/pages/UnlockVault.jsx
import { useState } from "react";
import { decryptPrivateKey } from "../utils/privateKeyBackup";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useNavigate, Link } from "react-router-dom";
import { KeyRound, LockKeyhole, ShieldAlert } from "lucide-react";

// Importing the reusable UI elements to match Login/Register pages
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";

const UnlockVault = () => {
  const { user } = useAuth();
  const { setPrivateKey } = useKey();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const unlockWithPassword = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (!user?.encryptedPrivateKey) {
        setMsg("Encrypted key not found on server.");
        return;
      }

      // Decrypt the key from the backend using their typed password
      const privateKey = await decryptPrivateKey(user.encryptedPrivateKey, password);

      setPrivateKey(privateKey);
      navigate("/files");
    } catch {
      setMsg("Incorrect master password");
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
          <header className="mb-8 text-center">
            <h2 className="text-slate-900 text-2xl font-bold tracking-tight">Unlock Vault</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Enter your master password to decrypt your keys</p>
          </header>

          {/* Crisp error message instead of raw text */}
          {msg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldAlert size={18} className="text-red-500" />
              {msg}
            </div>
          )}

          <form onSubmit={unlockWithPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-slate-700 text-sm font-semibold ml-1 block">
                Master Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                icon={KeyRound}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={loading} loading={loading} variant="primary">
                {!loading && <LockKeyhole size={18} className="mr-1.5" />}
                {loading ? "Decrypting Key..." : "Unlock Vault"}
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <Link to="/account" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Forgot Password? Recover Account
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default UnlockVault;