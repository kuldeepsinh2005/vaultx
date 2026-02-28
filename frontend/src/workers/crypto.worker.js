// frontend/src/workers/crypto.worker.js

self.onmessage = async (e) => {
  const { action, fileData, keyData, iv } = e.data;

  try {
    if (action === "ENCRYPT") {
      const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const exportedKey = await crypto.subtle.exportKey("raw", aesKey);
      const newIv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: newIv },
        aesKey,
        fileData
      );

      self.postMessage(
        { success: true, encryptedBuffer, exportedKey, iv: newIv },
        [encryptedBuffer, exportedKey, newIv.buffer]
      );
    } 
    
    else if (action === "DECRYPT") {
      const aesKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        "AES-GCM",
        true,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        fileData
      );

      self.postMessage(
        { success: true, decryptedBuffer },
        [decryptedBuffer]
      );
    }
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};