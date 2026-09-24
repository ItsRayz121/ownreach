import { ImageResponse } from "next/og";

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
          borderRadius: 96,
        }}
      >
        <div style={{ display: "flex", color: "#fff", fontSize: 288, fontWeight: 700, fontFamily: "sans-serif" }}>
          O
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
