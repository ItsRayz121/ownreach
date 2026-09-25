import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// OWASP-baseline argon2id parameters (19 MiB memory, 2 iterations, 1 thread).
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(plain: string, encodedHash: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plain);
  } catch {
    return false; // malformed/corrupt hash — fail closed, never throw out of an auth check
  }
}

// Kept intentionally simple — length only, no composition-rule "special character" theater.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

// Lazily computed and memoized on first use (not at import time — importing
// this module shouldn't pay an Argon2 hash on every cold start) so the
// "no such account" login branch can spend the same cost as a real
// verification, closing the timing side-channel a generic error message
// alone doesn't close.
let dummyHashPromise: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
  return (dummyHashPromise ??= hashPassword("dummy-timing-decoy-password"));
}
