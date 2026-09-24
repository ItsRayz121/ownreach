import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OwnReach — Own your reach. Keep your community.",
    short_name: "OwnReach",
    description:
      "A creator-first social network for building, messaging, and retaining your audience without depending entirely on one platform.",
    start_url: "/home",
    display: "standalone",
    background_color: "#fafaff",
    theme_color: "#1a1d24",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
