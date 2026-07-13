const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptCredential(value: string, secret: string): Promise<string> {
  if (!secret) throw new Error('AI credential encryption is not configured');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), encoder.encode(value));
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCredential(value: string, secret: string): Promise<string> {
  const [version, ivValue, encryptedValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !encryptedValue || !secret) throw new Error('AI credential is unavailable');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivValue) },
    await encryptionKey(secret),
    fromBase64(encryptedValue),
  );
  return decoder.decode(decrypted);
}
