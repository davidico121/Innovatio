import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

const DUMMY_HASH = `scrypt$${N}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // A missing hash still does the same work, so timing does not reveal which accounts exist.
  const [scheme, n, saltB64, keyB64] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), { N: Number(n), r: 8, p: 1 });
  return timingSafeEqual(actual, expected) && stored !== null;
}

// No 0/O or 1/l/I, so a password read from an email cannot be mistyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  return Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function validateNewPassword(password: string, confirm: string, avoid: string[]): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  if (password !== confirm) return "The two passwords do not match.";
  const lower = password.toLowerCase();
  if (avoid.some((a) => a && lower === a.toLowerCase())) return "Pick something different from your email.";
  if (/^(.)\1+$/.test(password)) return "Pick something less repetitive.";
  return null;
}
