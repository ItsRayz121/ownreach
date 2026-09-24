import { NextResponse } from "next/server";
import { issueSiweNonce } from "@/lib/auth/siwe";

export async function GET() {
  const nonce = await issueSiweNonce();
  return NextResponse.json({ nonce });
}
