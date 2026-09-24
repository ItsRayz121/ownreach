import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { getFollowersForExport } from "@/lib/data/analytics";

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const followers = await getFollowersForExport(session.userId);

  const lines = [
    "username,display_name,followed_at",
    ...followers.map((f) => [csvField(f.username), csvField(f.displayName), f.followedAt.toISOString()].join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="followers-${session.username}.csv"`,
    },
  });
}
