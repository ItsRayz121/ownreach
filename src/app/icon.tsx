import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", color: "#fff", fontSize: 108, fontWeight: 700, fontFamily: "sans-serif" }}>
          O
        </div>
      </div>
    ),
    size
  );
}
