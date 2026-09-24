import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cloudinary } from "@/lib/cloudinary";
import { verifySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/http";

const bodySchema = z.object({
  folder: z.enum(["avatars", "covers", "posts"]),
});

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet. Set the CLOUDINARY_* env vars." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `ownreach/${parsed.data.folder}/${session.userId}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
