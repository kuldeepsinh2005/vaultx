// frontend/src/utils/keypair.js
// Generate RSA public/private key pair
export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export public key (for backend)
export async function exportPublicKey(publicKey) {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

// Export private key (for encryption / backup)
export async function exportPrivateKey(privateKey) {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  return new Uint8Array(pkcs8);
}
