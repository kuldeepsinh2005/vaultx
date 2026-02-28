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

// ==========================================
// 🚀 MULTI-THREADED DOWNLOAD MANAGER (ULTRA FAST)
// Uses 10MB Chunks + Native C++ Blob Compilation
// ==========================================
const downloadConcurrently = async (url, totalSize, jobId, abortSignal) => {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (Drastically reduces TLS handshakes)
  const MAX_CONCURRENT = 4;
  
  // Array to hold the chunks in the exact correct order
  const chunksData = new Array(Math.ceil(totalSize / CHUNK_SIZE));
  let downloaded = 0;
  let lastUiUpdate = 0;

  // 1. Build the queue
  const queue = [];
  for (let start = 0, i = 0; start < totalSize; start += CHUNK_SIZE, i++) {
    queue.push({
      index: i,
      start,
      end: Math.min(start + CHUNK_SIZE - 1, totalSize - 1)
    });
  }

  // 2. Execute Worker Pool
  const workers = Array(Math.min(MAX_CONCURRENT, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      if (abortSignal.aborted) throw new Error("AbortError");
      
      const chunk = queue.shift();
      
      const res = await fetch(url, { 
        headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
        signal: abortSignal,
        cache: "no-store" 
      });
      
      if (!res.ok && res.status !== 206) {
        throw new Error("S3 CORS blocked Range request");
      }
      
      const buffer = await res.arrayBuffer();
      
      // Store in the exact index (O(1) operation, insanely fast)
      chunksData[chunk.index] = buffer;
      downloaded += buffer.byteLength;

      // ⚡ Direct DOM UI updates
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
  
  // ⚡ MAGIC HAPPENS HERE: We let the browser's C++ engine stitch the array together natively
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
      try {
        return await fn();
      } catch (err) {
        if (axios.isCancel(err) || err.message === "AbortError" || err.name === "CanceledError") throw err;
        const isNetworkError = !err.response || (err.response.status >= 500 && err.response.status <= 504);
        if (isNetworkError && i < maxRetries - 1) {
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

    updateTransfer(id, { status: "CANCELLED", phase: "Cancelled by user", progress: 0 });

    if (transfer.type === "UPLOAD" && transfer.uploadId) {
      try {
        await api.post("/files/multipart/abort", {
          uploadId: transfer.uploadId,
          storagePath: transfer.storagePath,
        });
      } catch (err) {}
    }
  };

  // ==========================================
  // 🚀 UPLOAD LOGIC
  // ==========================================
  const startGlobalUpload = async (fileList, folderId, publicKey) => {
    if (!fileList || fileList.length === 0) return;

    const CHUNK_SIZE = 5 * 1024 * 1024; 
    const MAX_CONCURRENT_UPLOADS = 4;

    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);

    const totalFiles = fileList.length;
    const isFolderUpload = totalFiles > 1 || (fileList[0].webkitRelativePath && fileList[0].webkitRelativePath.includes('/'));
    
    const jobName = isFolderUpload 
      ? (fileList[0].webkitRelativePath ? fileList[0].webkitRelativePath.split('/')[0] : `Batch of ${totalFiles} items`)
      : fileList[0].name;

    updateTransfer(jobId, {
      id: jobId, 
      name: jobName, 
      type: "UPLOAD", 
      status: "PROCESSING",
      phase: isFolderUpload ? "Preparing files..." : "Encrypting locally...", 
      progress: 0,
      isFolder: isFolderUpload,
      totalFiles: totalFiles,
      completedFiles: 0
    });

    let completed = 0;

    try {
      for (let i = 0; i < totalFiles; i++) {
        if (controller.signal.aborted) throw new Error("AbortError");
        
        const file = fileList[i];
        let currentUploadId = null;
        let currentStoragePath = null;

        updateTransfer(jobId, { 
          phase: isFolderUpload ? `Processing file ${i + 1} of ${totalFiles}...` : "Encrypting locally..." 
        });

        const { encryptedBuffer, exportedKey, iv } = await runCryptoWorker("ENCRYPT", { file });
        
        const importedAesKey = await crypto.subtle.importKey("raw", exportedKey, "AES-GCM", true, ["encrypt", "decrypt"]);
        const wrappedKey = await wrapAESKeyWithPublicKey(importedAesKey, publicKey);
        const ivBase64 = base64UrlEncode(iv);
        
        const encryptedBlob = new Blob([new Uint8Array(encryptedBuffer)], { type: "application/octet-stream" });
        const partsCount = Math.ceil(encryptedBlob.size / CHUNK_SIZE);

        const initRes = await withRetry(() => api.post("/files/multipart/initiate", {
          fileSize: encryptedBlob.size,
          partsCount
        }), jobId);
        
        currentUploadId = initRes.data.uploadId;
        currentStoragePath = initRes.data.storagePath;
        const { urls } = initRes.data;
        
        updateTransfer(jobId, { uploadId: currentUploadId, storagePath: currentStoragePath });

        const uploadedParts = [];
        const chunkProgress = {}; 
        let lastUiUpdate = 0; 

        const activeUploads = new Set(); 
        for (const part of urls) {
          if (controller.signal.aborted) throw new Error("AbortError");

          const start = (part.partNumber - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, encryptedBlob.size);
          const chunk = encryptedBlob.slice(start, end);

          const uploadPromise = withRetry(() => axios.put(part.url, chunk, {
            headers: { "Content-Type": "application/octet-stream" },
            signal: controller.signal,
            onUploadProgress: (progressEvent) => {
              chunkProgress[part.partNumber] = progressEvent.loaded;
              const now = Date.now();
              if (now - lastUiUpdate > 250 || progressEvent.loaded === progressEvent.total) {
                const currentFileLoaded = Object.values(chunkProgress).reduce((sum, val) => sum + val, 0);
                const filePercent = currentFileLoaded / encryptedBlob.size;
                const overallProgress = Math.round(((completed + filePercent) / totalFiles) * 100);
                
                const bar = document.getElementById(`progress-bar-${jobId}`);
                const text = document.getElementById(`progress-text-${jobId}`);
                if (bar) bar.style.width = `${overallProgress}%`;
                if (text) text.innerText = isFolderUpload ? `${completed}/${totalFiles}` : `${overallProgress}%`;
                lastUiUpdate = now;
              }
            }
          }), jobId).then((res) => {
            uploadedParts.push({ PartNumber: part.partNumber, ETag: res.headers.etag });
            activeUploads.delete(uploadPromise);
          });

          activeUploads.add(uploadPromise);
          if (activeUploads.size >= MAX_CONCURRENT_UPLOADS) await Promise.race(activeUploads);
        }

        await Promise.all(activeUploads);
        uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

        await withRetry(() => api.post("/files/multipart/complete", {
          uploadId: currentUploadId,
          storagePath: currentStoragePath,
          parts: uploadedParts,
          originalName: file.name,
          wrappedKey, iv: ivBase64,
          size: encryptedBlob.size,
          mimeType: file.type || "application/octet-stream",
          folderId: folderId || null,
          relativePath: file.webkitRelativePath || file.name
        }), jobId);

        completed++;
        updateTransfer(jobId, { completedFiles: completed });
      }

      if (!controller.signal.aborted) {
        updateTransfer(jobId, { status: "DONE", phase: isFolderUpload ? "Folder Upload Complete" : "Complete", progress: 100 });
      }

    } catch (err) {
      if (err.name === "AbortError" || axios.isCancel(err)) return;
      console.error("Upload Error:", err);
      updateTransfer(jobId, { status: "ERROR", phase: "Transfer failed" });
    } finally {
      abortControllers.current.delete(jobId);
    }
  };

  // ==========================================
  // 🚀 DOWNLOAD LOGIC
  // ==========================================
  const startGlobalDownload = async (file, privateKey) => {
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);

    updateTransfer(jobId, { 
      id: jobId, name: file.originalName, type: "DOWNLOAD", 
      status: "PROCESSING", phase: "Downloading...", progress: 0,
      isFolder: false
    });

    try {
      const ticketRes = await withRetry(() => api.get(`/files/presigned-download/${file._id}`), jobId);
      const s3Url = ticketRes.data.url;

      let finalArrayBuffer;

      try {
        if (!file.size) throw new Error("File size unknown");
        
        // 🚀 ATTEMPT 10MB / 4-THREAD CONCURRENT DOWNLOAD
        finalArrayBuffer = await downloadConcurrently(s3Url, file.size, jobId, controller.signal);
        
      } catch (parallelErr) {
        if (parallelErr.message === "AbortError") throw parallelErr;
        console.warn("Parallel download bypassed. Falling back to native stream...", parallelErr.message);
        
        // 🛡️ INDESTRUCTIBLE FALLBACK: Native Fetch Stream -> Blob Compilation
        const res = await fetch(s3Url, { signal: controller.signal, cache: 'no-store' });
        const reader = res.body.getReader();
        const contentLength = +res.headers.get("Content-Length") || file.size;
        
        const chunks = [];
        let loaded = 0; 
        let lastUiUpdate = 0;
        
        while(true) {
          const {done, value} = await reader.read();
          if(done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          const now = Date.now();
          if (now - lastUiUpdate > 250 || loaded === contentLength) {
             const percent = Math.min(Math.round((loaded / contentLength) * 100), 95);
             const bar = document.getElementById(`progress-bar-${jobId}`);
             const text = document.getElementById(`progress-text-${jobId}`);
             if (bar) bar.style.width = `${percent}%`;
             if (text) text.innerText = `${percent}%`;
             lastUiUpdate = now;
          }
        }
        finalArrayBuffer = await new Blob(chunks).arrayBuffer();
      }

      updateTransfer(jobId, { phase: "Decrypting locally...", progress: 99 });
      const bar = document.getElementById(`progress-bar-${jobId}`);
      if (bar) bar.style.width = `99%`;
      
      const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
      const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
      const cleanIv = new Uint8Array(universalDecode(file.iv));
      
      const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
        fileData: finalArrayBuffer,
        keyData: rawAesKey,
        iv: cleanIv
      });

      const { saveAs } = await import('file-saver');
      const finalBlob = new Blob([decryptedBuffer], { type: file.mimeType });
      saveAs(finalBlob, file.originalName);

      updateTransfer(jobId, { status: "DONE", phase: "Complete", progress: 100 });

    } catch (err) {
      if (err.name === "AbortError" || axios.isCancel(err)) return;
      console.error("Download Error:", err);
      updateTransfer(jobId, { status: "ERROR", phase: "Download failed" });
    } finally {
      abortControllers.current.delete(jobId);
    }
  };

  // ==========================================
  // FOLDER DOWNLOAD LOGIC
  // ==========================================
  const startGlobalFolderDownload = async (folderId, folderName, privateKey) => {
    const jobId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.current.set(jobId, controller);

    updateTransfer(jobId, { 
      id: jobId, name: `${folderName}.zip`, type: "DOWNLOAD", 
      status: "PROCESSING", phase: "Fetching files...", progress: 0,
      isFolder: true, completedFiles: 0, totalFiles: 0
    });

    try {
      const metaRes = await withRetry(() => api.get(`/folders/${folderId}/all-contents`), jobId);
      const { files } = metaRes.data;
      const totalFiles = files.length;
      
      updateTransfer(jobId, { totalFiles: totalFiles });

      const JSZip = (await import('jszip')).default;
      const saveAs = (await import('file-saver')).saveAs;
      const zip = new JSZip();

      const queue = [...files];
      let completed = 0;

      const zipWorker = async () => {
        while (queue.length > 0) {
          if (controller.signal.aborted) throw new Error("AbortError");
          const file = queue.shift();
          const ticket = await api.get(`/files/presigned-download/${file._id}`);
          
          const res = await fetch(ticket.data.url, { signal: controller.signal });
          const arrayBuffer = await res.arrayBuffer();
          
          const aesKey = await unwrapAESKeyWithPrivateKey(file.wrappedKey, privateKey);
          const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
          const cleanIv = new Uint8Array(universalDecode(file.iv));
          
          const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
            fileData: arrayBuffer,
            keyData: rawAesKey, 
            iv: cleanIv
          });
          
          const cleanPath = file.zipPath.replace(/^\//, '');
          zip.file(cleanPath, decryptedBuffer);
          completed++;
          
          const overallProgress = Math.round((completed / totalFiles) * 98);
          const bar = document.getElementById(`progress-bar-${jobId}`);
          const text = document.getElementById(`progress-text-${jobId}`);
          if (bar) bar.style.width = `${overallProgress}%`;
          if (text) text.innerText = `${completed}/${totalFiles}`;
          
          updateTransfer(jobId, { completedFiles: completed });
        }
      };

      await Promise.all(Array(Math.min(4, queue.length)).fill(null).map(zipWorker));

      updateTransfer(jobId, { phase: "Compressing...", progress: 99 });
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);

      updateTransfer(jobId, { status: "DONE", phase: "Complete", progress: 100 });

    } catch (err) {
      if (err.name === "AbortError" || axios.isCancel(err)) return;
      console.error("Folder Download Error:", err);
      updateTransfer(jobId, { status: "ERROR", phase: "Download failed" });
    } finally {
      abortControllers.current.delete(jobId);
    }
  };

  return (
    <TransferContext.Provider 
      value={{ 
        transfers, 
        cancelTransfer, 
        removeTransfer, 
        startGlobalUpload,
        startGlobalDownload,
        startGlobalFolderDownload
      }}
    >
      {children}
    </TransferContext.Provider>
  );
};