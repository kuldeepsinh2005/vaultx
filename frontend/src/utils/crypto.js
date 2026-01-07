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

// Encrypt (wrap) AES key using RSA public key
export async function wrapAESKeyWithPublicKey(aesKey, publicKeyBase64) {
  const rawAES = await crypto.subtle.exportKey("raw", aesKey);

  const publicKeyBytes = Uint8Array.from(
    atob(publicKeyBase64),
    (c) => c.charCodeAt(0)
  );

  const publicKey = await crypto.subtle.importKey(
    "spki",
    publicKeyBytes,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"]
  );

  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawAES
  );

 return base64UrlEncode(new Uint8Array(wrappedKey));

}

// Decrypt (unwrap) AES key using RSA private key
export async function unwrapAESKeyWithPrivateKey(
  wrappedKeyBase64,
  privateKey
) {
  const wrappedKey = base64UrlDecode(wrappedKeyBase64);

  const rawAES = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrappedKey
  );

  return crypto.subtle.importKey(
    "raw",
    rawAES,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}


function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(base64Url) {
  let base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
