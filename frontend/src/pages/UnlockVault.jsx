import { useState } from "react";
import { decryptPrivateKey } from "../utils/privateKeyBackup";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useNavigate, Link } from "react-router-dom";

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
      setMsg("Incorrect password ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Unlock Vault</h2>
        <p className="text-slate-400 text-sm text-center mb-8">Enter your master password to decrypt your keys.</p>

        <form onSubmit={unlockWithPassword} className="space-y-4">
          <input
            type="password"
            placeholder="Master Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950/50 text-white border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            autoFocus
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? "Decrypting..." : "Unlock"}
          </button>
        </form>

        {msg && <p className="mt-4 text-center text-sm font-bold text-red-400">{msg}</p>}

        <div className="mt-8 text-center">
          <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
            Forgot Password? Recover Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnlockVault;