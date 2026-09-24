import "server-only";
import { randomBytes } from "crypto";
import { SiweMessage, generateNonce } from "siwe";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { siweNonces } from "@/db/schema";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function issueSiweNonce() {
  const nonce = generateNonce();
  await db.insert(siweNonces).values({
    nonce,
    expiresAt: new Date(Date.now() + NONCE_TTL_MS),
  });

  // Best-effort cleanup of expired nonces so the table doesn't grow unbounded.
  db.delete(siweNonces).where(lt(siweNonces.expiresAt, new Date())).catch(() => {});

  return nonce;
}

export async function consumeSiweNonce(nonce: string) {
  const [row] = await db.delete(siweNonces).where(eq(siweNonces.nonce, nonce)).returning();
  if (!row) return false;
  return row.expiresAt.getTime() > Date.now();
}

export function randomLinkingState() {
  return randomBytes(16).toString("hex");
}

interface VerifySiweArgs {
  message: string;
  signature: string;
}

export async function verifySiwe({ message, signature }: VerifySiweArgs) {
  const siweMessage = new SiweMessage(message);

  if (siweMessage.domain !== new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").host) {
    throw new Error("Domain mismatch");
  }

  const nonceOk = await consumeSiweNonce(siweMessage.nonce);
  if (!nonceOk) {
    throw new Error("Nonce expired or already used");
  }

  const result = await siweMessage.verify({ signature, nonce: siweMessage.nonce });
  if (!result.success) {
    throw new Error(result.error?.type ?? "Signature verification failed");
  }

  return siweMessage.address;
}
