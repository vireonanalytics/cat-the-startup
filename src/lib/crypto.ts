import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encrypts a signup request's chosen password so it can sit in the database
// between "someone submitted a request" and "an admin clicked Approve"
// without ever being stored in plaintext. Symmetric (not a one-way hash)
// because approval needs the real password back, to hand to
// supabase.auth.signUp() - a hash can't be reversed for that. AES-256-GCM:
// a fresh random IV per call, and GCM's built-in auth tag means a tampered
// ciphertext fails to decrypt rather than silently returning garbage.
function getKey(): Buffer {
  const hex = process.env.SIGNUP_REQUEST_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SIGNUP_REQUEST_SECRET is missing or not a 64-char hex string (32 bytes) - check .env.local."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // iv (12) + authTag (16) + ciphertext, base64-joined so it's one text column.
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}
