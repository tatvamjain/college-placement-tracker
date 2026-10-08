import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" and open the board like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Placement Board",
    short_name: "Placements",
    description: "Live campus placements: companies, today's rounds, packages and results.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c0f",
    theme_color: "#0a0c0f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
