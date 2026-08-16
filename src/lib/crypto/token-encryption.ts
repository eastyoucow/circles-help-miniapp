import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requiredEnv } from "@/lib/env";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function getTokenEncryptionKey(): Buffer {
  const raw = requiredEnv("TOKEN_ENCRYPTION_KEY");

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === KEY_LENGTH) {
    return fromBase64;
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is too short.");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
