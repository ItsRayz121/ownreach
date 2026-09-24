import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <div style={{ display: "flex", color: "#fff", fontSize: 102, fontWeight: 700, fontFamily: "sans-serif" }}>
          O
        </div>
      </div>
    ),
    size
  );
}
