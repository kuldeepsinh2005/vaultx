// frontend/src/workers/crypto.worker.js

self.onmessage = async (e) => {
  const { action, fileData, keyData, iv } = e.data;

  try {
    if (action === "ENCRYPT") {
      // 1. Generate AES Key inside the worker
      const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      // 2. Export key to raw bytes so we can send it back to the main thread
      const exportedKey = await crypto.subtle.exportKey("raw", aesKey);

      // 3. Generate IV
      const newIv = crypto.getRandomValues(new Uint8Array(12));

      // 4. Encrypt the file buffer
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: newIv },
        aesKey,
        fileData
      );

      // 5. Send back using Zero-Copy Transfer (extremely memory efficient)
      self.postMessage(
        { success: true, encryptedBuffer, exportedKey, iv: newIv },
        [encryptedBuffer, exportedKey, newIv.buffer] // Transfer ownership
      );
    } 
    
   else if (action === "DECRYPT") {
      // 1. Rebuild the CryptoKey from the raw ArrayBuffer we sent
      const aesKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        "AES-GCM",
        true,
        ["decrypt"]
      );

      // 2. Decrypt the file buffer
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        fileData
      );

      // 3. Send back using Zero-Copy Transfer
      self.postMessage(
        { success: true, decryptedBuffer },
        [decryptedBuffer]
      );
    }
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};