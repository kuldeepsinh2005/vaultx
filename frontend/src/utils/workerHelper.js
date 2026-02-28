// frontend/src/utils/workerHelper.js

export const runCryptoWorker = async (action, payload) => {
  return new Promise(async (resolve, reject) => {
    const worker = new Worker(new URL("../workers/crypto.worker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate(); // Free memory immediately
    };

    worker.onerror = (err) => {
      console.error("Worker Error:", err);
      reject(err);
      worker.terminate();
    };

    try {
      let buffer;
      // Support the property name from both upload and download flows
      const inputData = payload.file || payload.fileData;

      // Extract ArrayBuffer regardless of what is passed in
      if (inputData instanceof Blob || inputData instanceof File) {
        buffer = await inputData.arrayBuffer();
      } else if (inputData instanceof ArrayBuffer) {
        buffer = inputData;
      } else if (inputData instanceof Uint8Array) {
        buffer = inputData.buffer;
      } else {
        throw new Error("Invalid file data type passed to worker");
      }

      if (action === "ENCRYPT") {
        // [buffer] tells the browser to MOVE the memory, not copy it (Zero-Copy)
        worker.postMessage({ action, fileData: buffer }, [buffer]);
      } else if (action === "DECRYPT") {
        worker.postMessage(
          { action, fileData: buffer, keyData: payload.keyData, iv: payload.iv },
          [buffer] 
        );
      }
    } catch (postError) {
      console.error("🚨 Worker Transfer Failed:", postError);
      reject(new Error("Failed to send data to background worker."));
      worker.terminate();
    }
  });
};