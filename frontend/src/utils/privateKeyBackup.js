// frontend/src/utils/privateKeyBackup.js
import { deriveKeyFromPassword } from "./pbkdf2";

// Encrypt private key and return backup object
export async function encryptPrivateKey(privateKey, password) {
  // Export private key to raw bytes
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);

  // Generate salt & IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive AES key from password
  const aesKey = await deriveKeyFromPassword(password, salt);

  // Encrypt private key
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    pkcs8
  );

  // Return backup payload
  return {
    version: 1,
    kdf: "PBKDF2",
    cipher: "AES-GCM",
    iterations: 250000,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedPrivateKey: btoa(
      String.fromCharCode(...new Uint8Array(encrypted))
    ),
  };
}


export async function decryptPrivateKey(backup, password) {
  try {
    const salt = Uint8Array.from(
      atob(backup.salt),
      (c) => c.charCodeAt(0)
    );

    const iv = Uint8Array.from(
      atob(backup.iv),
      (c) => c.charCodeAt(0)
    );

    const encrypted = Uint8Array.from(
      atob(backup.encryptedPrivateKey),
      (c) => c.charCodeAt(0)
    );

    // Re-derive AES key from password
    const aesKey = await deriveKeyFromPassword(password, salt);

    // Decrypt private key
    const pkcs8 = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encrypted
    );

    // Import private key back to CryptoKey
    return crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  } catch (err) {
    throw new Error("Invalid password or corrupted backup");
  }
}


export function validateBackupFile(backup) {
  if (!backup || typeof backup !== "object") {
    throw new Error("Invalid backup format");
  }

  const requiredFields = [
    "version",
    "kdf",
    "cipher",
    "iterations",
    "salt",
    "iv",
    "encryptedPrivateKey",
  ];

  for (const field of requiredFields) {
    if (!backup[field]) {
      throw new Error("Invalid private key backup file");
    }
  }

  if (backup.kdf !== "PBKDF2") {
    throw new Error("Unsupported key derivation method");
  }

  if (backup.cipher !== "AES-GCM") {
    throw new Error("Unsupported encryption algorithm");
  }

  if (backup.version !== 1) {
    throw new Error("Unsupported backup version");
  }

  return true;
}
