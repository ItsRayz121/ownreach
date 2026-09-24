import { ImageResponse } from "next/og";

// Maskable icons need ~40% safe-zone padding so OS shape masks (circle,
// squircle, …) don't clip the glyph — the background fills edge-to-edge.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6d5cf6 0%, #3f7dfb 100%)",
        }}
      >
        <div style={{ display: "flex", color: "#fff", fontSize: 184, fontWeight: 700, fontFamily: "sans-serif" }}>
          O
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
