import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const tokenPrefix = "enc:v1:";

function encryptionSecret() {
  return (
    process.env.SHOPEE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.SHOPEE_CLIENT_SECRET?.trim() ||
    process.env.SHOPEE_SECRET?.trim() ||
    ""
  );
}

function encryptionKey() {
  const secret = encryptionSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function sealToken(token: string) {
  const key = encryptionKey();
  if (!key || !token) return token;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${tokenPrefix}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openToken(value: string) {
  const key = encryptionKey();
  if (!key || !value.startsWith(tokenPrefix)) return value;

  const [ivText, tagText, encryptedText] = value.slice(tokenPrefix.length).split(".");
  if (!ivText || !tagText || !encryptedText) return "";

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
