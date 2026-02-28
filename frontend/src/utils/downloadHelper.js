// frontend/src/utils/downloadHelper.js
import axios from "axios";
import { saveAs } from "file-saver";
import { unwrapAESKeyWithPrivateKey, universalDecode } from "./crypto";
import { runCryptoWorker } from "./workerHelper";

/**
 * A universal helper to download and decrypt E2EE files securely.
 */
export const secureDownload = async ({
  presignedUrl,
  wrappedKey,
  ivBase64,
  privateKey,
  mimeType,
  originalName,
  onProgress // Optional callback for progress bars
}) => {
  // 1. Download from AWS S3
  const res = await axios.get(presignedUrl, { 
    responseType: "blob",
    onDownloadProgress: onProgress 
  });
  
  // 2. Unwrap the custom AES key using the user's private key
  const aesKey = await unwrapAESKeyWithPrivateKey(wrappedKey, privateKey);
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  
  // 3. Decrypt via Web Worker
  const cleanIv = new Uint8Array(universalDecode(ivBase64));
  const { decryptedBuffer } = await runCryptoWorker("DECRYPT", {
    file: res.data,
    keyData: rawAesKey,
    iv: cleanIv
  });

  // 4. Save to disk
  const blob = new Blob([decryptedBuffer], { type: mimeType });
  saveAs(blob, originalName);
};