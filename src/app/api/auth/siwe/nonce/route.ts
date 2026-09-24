import { NextRequest, NextResponse } from "next/server";
import { issueSiweNonce } from "@/lib/auth/siwe";
import { getClientIp } from "@/lib/auth/http";
import { checkRateLimitResponse } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  const rateLimited = await checkRateLimitResponse("auth:siwe:nonce", getClientIp(req), { limit: 20, window: "10 m" });
  if (rateLimited) return rateLimited;

  const nonce = await issueSiweNonce();
  return NextResponse.json({ nonce });
}
