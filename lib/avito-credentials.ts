import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.AVITO_CREDENTIALS_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error(
      "Не задан AVITO_CREDENTIALS_ENCRYPTION_KEY в переменных окружения.",
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(rawKey)) {
    throw new Error(
      "AVITO_CREDENTIALS_ENCRYPTION_KEY должен содержать ровно 64 шестнадцатеричных символа.",
    );
  }

  return Buffer.from(rawKey, "hex");
}

export function encryptAvitoSecret(value: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptAvitoSecret(encryptedValue: string) {
  const key = getEncryptionKey();
  const payload = Buffer.from(encryptedValue, "base64");

  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Не удалось расшифровать сохранённые данные Авито.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}