import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cloudinary } from "@/lib/cloudinary";
import { verifySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/http";
import { checkRateLimitResponse } from "@/lib/ratelimit";

const bodySchema = z.object({
  folder: z.enum(["avatars", "covers", "posts", "community-avatars", "messages"]),
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

  // Chat images are otherwise only bounded by sendMessage/sendChannelMessage's
  // own "message:send" limit — but that's enforced at the DB-insert step, not
  // at upload time, so without a limit here too a caller could hit this
  // route directly and upload unbounded images into their own Cloudinary
  // folder without ever sending a message that references them.
  if (parsed.data.folder === "messages") {
    const rateLimitError = await checkRateLimitResponse("message:media-upload", session.userId, { limit: 60, window: "10 m" });
    if (rateLimitError) return rateLimitError;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `ownreach/${parsed.data.folder}/${session.userId}`;

  // Chat images are compressed hard at upload time via a Cloudinary eager
  // transformation, so the asset stored at rest (not just what's served
  // later) is already capped in size — unlike avatars/posts, which keep the
  // original for later re-cropping. Chats can otherwise accumulate a lot of
  // full-resolution photos, which is the thing worth bounding for
  // storage/bandwidth.
  const transformation = parsed.data.folder === "messages" ? "w_1600,h_1600,c_limit,q_auto:good,f_auto" : undefined;

  const paramsToSign: Record<string, string | number> = { timestamp, folder };
  if (transformation) paramsToSign.transformation = transformation;

  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    transformation,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
