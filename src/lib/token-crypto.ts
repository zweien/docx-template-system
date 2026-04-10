import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ENCRYPTION_KEY = process.env.API_TOKEN_ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";
const TOKEN_PREFIX = "idrl_";

// Validation at module load
if (!ENCRYPTION_KEY || !/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) {
  console.warn(
    "[token-crypto] API_TOKEN_ENCRYPTION_KEY is not set or invalid (expected 64 hex chars). Token encryption will fail."
  );
}

/** SHA-256 hash of token for storage and lookup */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** AES-256-GCM encrypt token for reversible display */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("API_TOKEN_ENCRYPTION_KEY 未配置或无效");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

/** Decrypt encrypted token back to plaintext */
export function decryptToken(encryptedText: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("API_TOKEN_ENCRYPTION_KEY 未配置或无效");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Generate a new API token: idrl_ + 32 random hex bytes */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("hex");
}

/** Extract prefix for display: first 9 chars (idrl_xxxx) */
export function getTokenPrefix(token: string): string {
  return token.slice(0, 9);
}
