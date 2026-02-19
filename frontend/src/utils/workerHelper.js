// frontend/src/utils/workerHelper.js

export const runCryptoWorker = async (action, payload) => {
  return new Promise(async (resolve, reject) => {
    // Initialize the worker
    const worker = new Worker(new URL("../workers/crypto.worker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate(); // Kill worker to free up memory immediately
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    // Convert Blob/File to ArrayBuffer before sending
    // Convert Blob/File to ArrayBuffer before sending
    let buffer;
    if (payload.file instanceof Blob || payload.file instanceof File) {
      buffer = await payload.file.arrayBuffer();
    } else {
      buffer = payload.file; 
    }

    try {
      if (action === "ENCRYPT") {
        worker.postMessage({ action, fileData: buffer }, [buffer]);
      } else if (action === "DECRYPT") {
        worker.postMessage(
            { action, fileData: buffer, keyData: payload.keyData, iv: payload.iv },
            [buffer] // <--- Only transfer the file buffer
        );
      }
    } catch (postError) {
      // ✅ FIX: Catch immediate cloning errors
      console.error("🚨 Worker PostMessage Failed:", postError);
      reject(new Error("Failed to send data to background worker."));
      worker.terminate();
    }
  });
};