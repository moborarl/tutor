// Password/PIN hashing (PBKDF2-SHA256) and cookie signing (HMAC-SHA256),
// all via WebCrypto so no nodejs_compat is needed.

const PBKDF2_ITERATIONS = 100_000;
const HASH_BYTES = 32;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pbkdf2(secret: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BYTES * 8,
  );
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(secret, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(derived)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [iterStr, saltB64, hashB64] = stored.split('$');
  if (!iterStr || !saltB64 || !hashB64) return false;
  const derived = await pbkdf2(secret, fromB64(saltB64), parseInt(iterStr, 10));
  const a = new Uint8Array(derived);
  const b = fromB64(hashB64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signValue(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return `${value}.${toB64(sig).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

export async function verifySignedValue(signed: string, secret: string): Promise<string | null> {
  const dot = signed.lastIndexOf('.');
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const expected = await signValue(value, secret);
  // constant-time-ish compare of the full signed strings
  if (expected.length !== signed.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signed.charCodeAt(i);
  return diff === 0 ? value : null;
}

export function randomId(bytes = 24): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
