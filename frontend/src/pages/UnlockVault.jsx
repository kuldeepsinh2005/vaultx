// frontend/src/pages/UnlockVault.jsx
import { useState } from "react";
import { decryptPrivateKey } from "../utils/privateKeyBackup";
import { useAuth } from "../context/AuthContext";
import { useKey } from "../context/KeyContext";
import { useNavigate } from "react-router-dom";

const UnlockVault = () => {
  const { user , api } = useAuth();
  const { setPrivateKey } = useKey();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [backupFile, setBackupFile] = useState(null);
  const [useBackup, setUseBackup] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔑 NORMAL UNLOCK (backend encrypted key)
  const unlockWithPassword = async () => {
    setMsg("");
    setLoading(true);

    try {
      if (!user?.encryptedPrivateKey) {
        setMsg("Encrypted key not found. Use backup recovery.");
        return;
      }

      const privateKey = await decryptPrivateKey(
        user.encryptedPrivateKey,
        password
      );

      setPrivateKey(privateKey);
      navigate("/files");
    } catch {
      setMsg("Incorrect password ❌");
    } finally {
      setLoading(false);
    }
  };

  // 🧯 RECOVERY UNLOCK (backup file)
  const unlockWithBackup = async () => {
    setMsg("");
    setLoading(true);

    try {
        if (!backupFile) {
        setMsg("Please select a backup file");
        return;
        }

        const text = await backupFile.text();
        const backup = JSON.parse(text);

        // 1️⃣ Decrypt private key
        const privateKey = await decryptPrivateKey(
        backup,
        password
        );
        console.log("1");
        // 2️⃣ Re-store encrypted private key on backend
        await api.post("/keys/restore", {
        encryptedPrivateKey: backup,
        });
        console.log("2");
        // 3️⃣ Unlock vault in memory
        setPrivateKey(privateKey);
        navigate("/files");

    } catch {
        setMsg("Recovery failed ❌");
    } finally {
        setLoading(false);
    }
    };

  return (
    <div>
      <h2>{useBackup ? "Recover Vault" : "Unlock Vault"}</h2>

      <input
        type="password"
        placeholder="Enter account password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {useBackup && (
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setBackupFile(e.target.files[0])}
        />
      )}

      <button
        onClick={useBackup ? unlockWithBackup : unlockWithPassword}
        disabled={loading}
      >
        {loading ? "Unlocking..." : "Unlock"}
      </button>

      {msg && <p>{msg}</p>}

      <p style={{ marginTop: "1rem" }}>
        {useBackup ? (
          <button onClick={() => setUseBackup(false)}>
            Use normal unlock
          </button>
        ) : (
          <button onClick={() => setUseBackup(true)}>
            Recover using backup
          </button>
        )}
      </p>
    </div>
  );
};

export default UnlockVault;
