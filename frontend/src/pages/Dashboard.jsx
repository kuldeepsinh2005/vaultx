// frontend/src/pages/Dashboard.jsx
import { useAuth } from "../context/AuthContext";
import { generateAESKey, encryptFile, exportAESKey } from "../utils/crypto";
import { useState } from "react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user, logout, api } = useAuth();
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  
  const handleUpload = async () => {
    if (!file) return;

    try {
      // 1. Generate AES key
      const aesKey = await generateAESKey();

      // 2. Encrypt file
      const { encryptedBuffer, iv } = await encryptFile(file, aesKey);

      // 3. Export AES key (TEMP — later encrypt with public key)
      const encryptedKey = await exportAESKey(aesKey);

      // 4. Create blob
      const encryptedBlob = new Blob([iv, new Uint8Array(encryptedBuffer)]);

      const formData = new FormData();
      formData.append("file", encryptedBlob, file.name);
      formData.append("encryptedKey", encryptedKey);

      await api.post("/files/upload", formData);

      setMessage("File uploaded securely ✅");
    } catch (err) {
      console.error(err);
      setMessage("Upload failed ❌");
    }
  };

  return (
    <div>
      <h2>Dashboard</h2>

      <p>Welcome, <strong>{user?.username}</strong></p>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload Encrypted File</button>

      {message && <p>{message}</p>}


      <p>Welcome, <strong>{user?.username}</strong></p>

      <Link to="/files">Go to My Files</Link>

      <br /><br />
      <button onClick={logout}>Logout</button>
      
    </div>

  );
};

export default Dashboard;
