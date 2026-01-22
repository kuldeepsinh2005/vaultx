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

export async function decryptFile(encryptedBlob, aesKey, iv) {
  // 1. Convert Blob to ArrayBuffer explicitly
  const encryptedData = await encryptedBlob.arrayBuffer();
  
  // 2. Ensure IV is a Uint8Array (SubtleCrypto requires this)
  const ivBuffer = iv instanceof Uint8Array ? iv : new Uint8Array(iv);

  console.log("IV for Decryption:", ivBuffer);
  console.log("Encrypted Data Size:", encryptedData.byteLength);

  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    aesKey,
    encryptedData
  );
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
export async function unwrapAESKeyWithPrivateKey(wrappedKeyBase64, privateKey) {
  const wrappedKey = universalDecode(wrappedKeyBase64); // Fixed

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

export function universalDecode(b64) {
  if (!b64) return new Uint8Array();
  // Restore standard Base64 characters from URL-safe ones
  let standard = b64.replace(/-/g, '+').replace(/_/g, '/');
  // Restore necessary padding
  while (standard.length % 4) standard += '=';
  
  const binaryString = atob(standard);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}


export function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(base64Url) {
  let base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export function base64UrlToUint8Array(base64Url) {
  let base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  return Uint8Array.from(
    atob(base64),
    c => c.charCodeAt(0)
  );
}

export function base64ToUint8Array(base64) {
  // Ensure we handle potential URL-safe characters just in case, 
  // and fix padding for atob
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}