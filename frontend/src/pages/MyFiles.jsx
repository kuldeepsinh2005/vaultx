// frontend/src/pages/MyFiles.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { importAESKey, decryptFile } from "../utils/crypto";

const MyFiles = () => {
  const { api } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await api.get("/files/my");
        setFiles(res.data.files || []);
      } catch (err) {
        setError("Failed to load files");
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  if (loading) return <p>Loading files...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;


  const handleDownload = async (file) => {
        try {
            // 1. Fetch encrypted file
            const res = await api.get(`/files/download/${file._id}`, {
            responseType: "blob",
            });

            // 2. Import AES key
            const aesKey = await importAESKey(file.encryptedKey);

            // 3. Decrypt file
            const decryptedBuffer = await decryptFile(res.data, aesKey);

            // 4. Create downloadable blob
            const blob = new Blob([decryptedBuffer]);

            // 5. Trigger browser download
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.originalName;
            a.click();

            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("Decryption failed");
        }
    };


  return (
    <div>
      <h2>My Encrypted Files</h2>

      {files.length === 0 ? (
        <p>No files uploaded yet.</p>
      ) : (
        <ul>
          {files.map((file) => (
            <li key={file._id}>
              <strong>{file.originalName}</strong>{" "}
              ({Math.round(file.size / 1024)} KB)
              {" "}
             <button onClick={() => handleDownload(file)}>
                Download (Decrypt)
            </button>

            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyFiles;
