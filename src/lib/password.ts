import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

// argon2id (kitabxananın default alqoritmi), OWASP tövsiyəsinə uyğun parametrlər
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export { PASSWORD_MIN, passwordProblem } from "./password-rules";

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Mövcud olmayan email üçün də eyni vaxt sərf olunsun deyə (istifadəçi siyahısını təxmin etməyə mane olur)
let dummy: Promise<string> | null = null;
export async function burnVerify(password: string): Promise<void> {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummy, password);
}

// Admin şifrəni sıfırlayanda / yeni istifadəçi yaradanda göstərilən müvəqqəti şifrə (qarışdırıla bilən simvollar yoxdur)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export function generatePassword(length = 12): string {
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
