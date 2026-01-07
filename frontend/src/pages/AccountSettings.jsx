import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  validateBackupFile,
} from "../utils/privateKeyBackup";


const AccountSettings = () => {
  const { api, user } = useAuth();

  // Username state
  const [username, setUsername] = useState(user.username);
  const [usernameMsg, setUsernameMsg] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password state
  const [backupFile, setBackupFile] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  /* =========================
     CHANGE USERNAME
     ========================= */
  const updateUsername = async () => {
    setUsernameMsg("");

    if (!username.trim()) {
      setUsernameMsg("Username cannot be empty");
      return;
    }

    if (username === user.username) {
      setUsernameMsg("New username must be different");
      return;
    }

    try {
      setUsernameLoading(true);
      await api.patch("/account/username", { username });
      setUsernameMsg("Username updated successfully ✅");
    } catch (err) {
      if (err.response?.status === 409) {
        setUsernameMsg("Username already exists ❌");
      } else {
        setUsernameMsg("Failed to update username ❌");
      }
    } finally {
      setUsernameLoading(false);
    }
  };

  /* =========================
     CHANGE PASSWORD
     ========================= */
  const updatePassword = async () => {
    setPasswordMsg("");

    const needsBackup = !user?.encryptedPrivateKey;

    if (needsBackup && !backupFile) {
      setPasswordMsg("Please upload your private key backup");
      return;
    }

    if (!oldPassword || !newPassword) {
      setPasswordMsg("Both old and new passwords are required");
      return;
    }

    if (oldPassword === newPassword) {
      setPasswordMsg("New password must be different");
      return;
    }

    try {
      setPasswordLoading(true);

      // 1️⃣ Read & parse backup file
      let privateKey;

      // 🔑 Prefer backend encrypted key
      if (user?.encryptedPrivateKey) {
        privateKey = await decryptPrivateKey(
          user.encryptedPrivateKey,
          oldPassword
        );
      } else {
        // 🧯 Recovery path
        const text = await backupFile.text();
        let backup;

        try {
          backup = JSON.parse(text);
        } catch {
          throw new Error("Backup file is not valid JSON");
        }

        validateBackupFile(backup);

        privateKey = await decryptPrivateKey(
          backup,
          oldPassword
        );
      }


      // 4️⃣ Update password on backend
      await api.patch("/account/password", {
        oldPassword,
        newPassword,
      });

      // 5️⃣ Re-encrypt private key with NEW password
      const newBackup = await encryptPrivateKey(
        privateKey,
        newPassword
      );

      // 6️⃣ Download new backup
      const blob = new Blob(
        [JSON.stringify(newBackup, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vaultx-private-key-backup.json";
      a.click();
      URL.revokeObjectURL(url);

      await api.post("/keys/restore", {
        encryptedPrivateKey: newBackup,
      });

      setPasswordMsg(
        "Password changed & new private key backup downloaded ✅"
      );
      // Cleanup
      setOldPassword("");
      setNewPassword("");
      setBackupFile(null);
    } catch (err) {
        if (err.message.includes("backup")) {
          setPasswordMsg(err.message + " ❌");
        } else if (err.message.includes("Invalid password")) {
          setPasswordMsg("Incorrect old password ❌");
        } else {
          setPasswordMsg("Password change failed ❌");
        }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 space-y-10">
      <h1 className="text-3xl font-bold text-gray-800">
        Account Settings
      </h1>

      {/* ================= USERNAME ================= */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">
          Change Username
        </h2>

        <input
          className="w-full border rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <button
          onClick={updateUsername}
          disabled={usernameLoading}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {usernameLoading ? "Updating..." : "Update Username"}
        </button>

        {usernameMsg && (
          <p className="mt-3 text-sm text-gray-700">
            {usernameMsg}
          </p>
        )}
      </div>

      {/* ================= PASSWORD ================= */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">
          Change Password
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          Changing your password requires your private key backup.
          A new encrypted backup will be generated.
        </p>

        <input
          type="file"
          accept="application/json"
          onChange={(e) => setBackupFile(e.target.files[0])}
          className="mb-3"
        />

        <input
          type="password"
          placeholder="Old password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 mb-3"
        />

        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 mb-4"
        />

        <button
          onClick={updatePassword}
          disabled={passwordLoading}
          className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {passwordLoading ? "Processing..." : "Change Password"}
        </button>

        {passwordMsg && (
          <p className="mt-3 text-sm text-gray-700">
            {passwordMsg}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
