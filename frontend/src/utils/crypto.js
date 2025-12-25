// frontend/src/utils/crypto.js
export async function generateAESKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptFile(file, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileBuffer
  );

  return {
    encryptedBuffer,
    iv,
  };
}

export async function exportAESKey(aesKey) {
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  // Make Base64 URL-safe
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


export async function importAESKey(base64Url) {
  // Restore Base64 padding
  let base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );
}

export async function decryptFile(encryptedBlob, aesKey) {
  const buffer = await encryptedBlob.arrayBuffer();

  const iv = buffer.slice(0, 12);
  const encryptedData = buffer.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    aesKey,
    encryptedData
  );

  return decrypted;
}

