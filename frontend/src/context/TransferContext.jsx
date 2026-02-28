// frontend/src/context/TransferContext.jsx
import React, { createContext, useContext, useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { runCryptoWorker } from "../utils/workerHelper";
import { 
  wrapAESKeyWithPublicKey, 
  base64UrlEncode, 
  unwrapAESKeyWithPrivateKey, 
  universalDecode 
} from "../utils/crypto";

const TransferContext = createContext();

export const useTransfers = () => useContext(TransferContext);

const downloadConcurrently = async (url, totalSize, jobId, abortSignal) => {
  const CHUNK_SIZE = 10 * 1024 * 1024; 
  const MAX_CONCURRENT = 4;
  const chunksData = new Array(Math.ceil(totalSize / CHUNK_SIZE));
  let downloaded = 0;
  let lastUiUpdate = 0;

  const queue = [];
  for (let start = 0, i = 0; start < totalSize; start += CHUNK_SIZE, i++) {
    queue.push({ index: i, start, end: Math.min(start + CHUNK_SIZE - 1, totalSize - 1) });
  }

  const workers = Array(Math.min(MAX_CONCURRENT, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      if (abortSignal.aborted) throw new Error("AbortError");
      const chunk = queue.shift();
      const res = await fetch(url, { headers: { Range: `bytes=${chunk.start}-${chunk.end}` }, signal: abortSignal, cache: "no-store" });
      if (!res.ok && res.status !== 206) throw new Error("S3 CORS blocked Range request");
      const buffer = await res.arrayBuffer();
      chunksData[chunk.index] = buffer;
      downloaded += buffer.byteLength;
      const now = Date.now();
      if (now - lastUiUpdate > 250 || downloaded === totalSize) {
        const percent = Math.min(Math.round((downloaded / totalSize) * 100), 95);
        const bar = document.getElementById(`progress-bar-${jobId}`);
        const text = document.getElementById(`progress-text-${jobId}`);
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = `${percent}%`;
        lastUiUpdate = now;
      }
    }
  });
  await Promise.all(workers);
  return await new Blob(chunksData).arrayBuffer();
};

export const TransferProvider = ({ children }) => {
  const { api } = useAuth();
  const [transfers, setTransfers] = useState({});
  const abortControllers = useRef(new Map());

  const updateTransfer = (id, data) => {
    setTransfers((prev) => ({ ...prev, [id]: { ...prev[id], ...data } }));
  };

  const removeTransfer = (id) => {
    setTransfers((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const withRetry = async (fn, jobId, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try { return await fn(); } catch (err) {
        if (axios.isCancel(err) || err.message === "AbortError") throw err;
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          updateTransfer(jobId, { phase: `Reconnecting in ${delay/1000}s...` });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  };

  const cancelTransfer = async (id) => {
    const transfer = transfers[id];
    if (!transfer) return;
    if (abortControllers.current.has(id)) {
      abortControllers.current.get(id).abort();
      abortControllers.current.delete(id);
    }
    updateTransfer(id, { status: "CANCELLED", phase: "Cancelled", progress: 0 });
  };

  const startGlobalUpload = async (fileList, folderId, publicKey) => {
    if (!fileList || fileList.length === 0) return;
    const CHUNK_SIZE = 5 * 1024 * 1024; const MAX_CONCURRENT_UPLOADS = 4;
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);
    const totalFiles = fileList.length;
    const isFolder = totalFiles > 1 || (fileList[0].webkitRelativePath && fileList[0].webkitRelativePath.includes('/'));
    const jobName = isFolder ? (fileList[0].webkitRelativePath ? fileList[0].webkitRelativePath.split('/')[0] : `Batch of ${totalFiles}`) : fileList[0].name;

    updateTransfer(jobId, { id: jobId, name: jobName, type: "UPLOAD", status: "PROCESSING", phase: "Encrypting...", progress: 0, isFolder, totalFiles, completedFiles: 0 });
    let completed = 0;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        updateTransfer(jobId, { phase: isFolder ? `Processing ${i + 1}/${totalFiles}` : "Encrypting..." });
        const { encryptedBuffer, exportedKey, iv } = await runCryptoWorker("ENCRYPT", { file });
        const importedAesKey = await crypto.subtle.importKey("raw", exportedKey, "AES-GCM", true, ["encrypt", "decrypt"]);
        const wrappedKey = await wrapAESKeyWithPublicKey(importedAesKey, publicKey);
        const encryptedBlob = new Blob([new Uint8Array(encryptedBuffer)], { type: "application/octet-stream" });
        const initRes = await withRetry(() => api.post("/files/multipart/initiate", { fileSize: encryptedBlob.size, partsCount: Math.ceil(encryptedBlob.size / CHUNK_SIZE) }), jobId);
        
        const { uploadId, storagePath, urls } = initRes.data;
        const uploadedParts = []; const activeUploads = new Set(); const chunkProgress = {}; let lastUiUpdate = 0;

        for (const part of urls) {
          const chunk = encryptedBlob.slice((part.partNumber - 1) * CHUNK_SIZE, Math.min(part.partNumber * CHUNK_SIZE, encryptedBlob.size));
          const uploadPromise = withRetry(() => axios.put(part.url, chunk, { signal: controller.signal, onUploadProgress: (p) => {
            chunkProgress[part.partNumber] = p.loaded;
            const now = Date.now();
            if (now - lastUiUpdate > 250 || p.loaded === p.total) {
              const filePercent = Object.values(chunkProgress).reduce((a, b) => a + b, 0) / encryptedBlob.size;
              const overall = Math.round(((completed + filePercent) / totalFiles) * 100);
              const bar = document.getElementById(`progress-bar-${jobId}`);
              const text = document.getElementById(`progress-text-${jobId}`);
              if (bar) bar.style.width = `${overall}%`;
              if (text) text.innerText = isFolder ? `${completed}/${totalFiles}` : `${overall}%`;
              lastUiUpdate = now;
            }
          }}), jobId).then((res) => {
            uploadedParts.push({ PartNumber: part.partNumber, ETag: res.headers.etag });
            activeUploads.delete(uploadPromise);
          });
          activeUploads.add(uploadPromise);
          if (activeUploads.size >= MAX_CONCURRENT_UPLOADS) await Promise.race(activeUploads);
        }
        await Promise.all(activeUploads);
        uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);
        await withRetry(() => api.post("/files/multipart/complete", { uploadId, storagePath, parts: uploadedParts, originalName: file.name, wrappedKey, iv: base64UrlEncode(iv), size: encryptedBlob.size, mimeType: file.type || "application/octet-stream", folderId, relativePath: file.webkitRelativePath || file.name }), jobId);
        completed++; updateTransfer(jobId, { completedFiles: completed, progress: Math.round((completed / totalFiles) * 100) });
      }
      updateTransfer(jobId, { status: "DONE", phase: "Complete", progress: 100 });
    } catch (err) {
      if (err.name === "AbortError") return;
      updateTransfer(jobId, { status: "ERROR", phase: "Failed" });
    }
  };

  const startGlobalDownload = async (file, privateKey) => {
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);
    updateTransfer(jobId, { id: jobId, name: file.originalName, type: "DOWNLOAD", status: "PROCESSING", phase: "Downloading...", progress: 0, isFolder: false });
    try {
      const ticketRes = await withRetry(() => api.get(`/files/presigned-download/${file._id}`), jobId);
      const arrayBuffer = await downloadConcurrently(ticketRes.data.url, file.size, jobId, controller.signal);
      updateTransfer(jobId, { phase: "Decrypting...", progress: 99 });
      const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
      const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
      const { decryptedBuffer } = await runCryptoWorker("DECRYPT", { file: arrayBuffer, keyData: rawAesKey, iv: new Uint8Array(universalDecode(file.iv)) });
      const { saveAs } = await import('file-saver');
      saveAs(new Blob([decryptedBuffer], { type: file.mimeType }), file.originalName);
      updateTransfer(jobId, { status: "DONE", phase: "Complete", progress: 100 });
    } catch (err) {
      if (err.name === "AbortError") return;
      updateTransfer(jobId, { status: "ERROR", phase: "Failed" });
    }
  };

  // ==========================================
  // 🚀 FOLDER DOWNLOAD (SMOOTH BYTE TRACKING ADDED)
  // ==========================================
  const startGlobalFolderDownload = async (folderId, folderName, privateKey, isShared = false, ownerId = null) => {
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);

    updateTransfer(jobId, { id: jobId, name: `${folderName}.zip`, type: "DOWNLOAD", status: "PROCESSING", phase: "Building tree...", progress: 0, isFolder: true, completedFiles: 0, totalFiles: 0 });

    try {
      const endpoint = isShared 
        ? `/shares/folder/${folderId}/all-contents?ownerId=${ownerId}` 
        : `/folders/${folderId}/all-contents`;
        
      const metaRes = await withRetry(() => api.get(endpoint), jobId);
      const { files } = metaRes.data;
      const totalFiles = files.length;
      updateTransfer(jobId, { totalFiles: totalFiles });

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let completed = 0;
      
      // ✅ NEW: Track the partial byte progress of files actively downloading
      const activeProgress = {}; 
      let lastUiUpdate = 0;

      const zipWorker = async () => {
        while (files.length > 0) {
          if (controller.signal.aborted) throw new Error("AbortError");
          const file = files.shift();
          const ticket = await api.get(`/files/presigned-download/${file._id}`);
          
          activeProgress[file._id] = 0; // Initialize tracking for this file

          // ✅ NEW: Added onDownloadProgress to track bytes without changing the core axios fetch
          const res = await axios.get(ticket.data.url, { 
            responseType: "arraybuffer", 
            signal: controller.signal,
            onDownloadProgress: (p) => {
              if (p.total) {
                activeProgress[file._id] = p.loaded / p.total;
                const now = Date.now();
                if (now - lastUiUpdate > 250) {
                  // Calculate fractional progress: (Fully Completed Files + Fractions of Active Files) / Total
                  const partialSum = Object.values(activeProgress).reduce((a, b) => a + b, 0);
                  const overallProgress = Math.min(Math.round(((completed + partialSum) / totalFiles) * 98), 98);
                  
                  const bar = document.getElementById(`progress-bar-${jobId}`);
                  if (bar) bar.style.width = `${overallProgress}%`;
                  lastUiUpdate = now;
                }
              }
            }
          });
          
          delete activeProgress[file._id]; // Remove from active tracking once finished

          const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
          const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
          const { decryptedBuffer } = await runCryptoWorker("DECRYPT", { file: res.data, keyData: rawAesKey, iv: new Uint8Array(universalDecode(file.iv)) });
          
          const cleanPath = file.zipPath.replace(/^\//, '');
          zip.file(cleanPath, decryptedBuffer);
          completed++;
          
          const overallProgress = Math.round((completed / totalFiles) * 98);
          
          const bar = document.getElementById(`progress-bar-${jobId}`);
          const text = document.getElementById(`progress-text-${jobId}`);
          if (bar) bar.style.width = `${overallProgress}%`;
          if (text) text.innerText = `${completed}/${totalFiles}`;
          
          updateTransfer(jobId, { 
            completedFiles: completed,
            progress: overallProgress,
            phase: `Downloading ${completed}/${totalFiles}`
          });
        }
      };

      await Promise.all(Array(Math.min(4, totalFiles)).fill(null).map(zipWorker));
      
      updateTransfer(jobId, { phase: "Zipping...", progress: 99 });
      const { saveAs } = await import('file-saver');
      saveAs(await zip.generateAsync({ type: "blob" }), `${folderName}.zip`);
      updateTransfer(jobId, { status: "DONE", phase: "Complete", progress: 100 });
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      updateTransfer(jobId, { status: "ERROR", phase: "Failed" });
    } finally {
        abortControllers.current.delete(jobId);
    }
  };

  return (
    <TransferContext.Provider value={{ transfers, cancelTransfer, removeTransfer, startGlobalUpload, startGlobalDownload, startGlobalFolderDownload }}>
      {children}
    </TransferContext.Provider>
  );
};