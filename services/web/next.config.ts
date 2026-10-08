import type { NextConfig } from "next";

// In production Caddy sends /api/* to the services before a request ever reaches
// Next. These rewrites do the same job during `npm run dev`, so the browser always
// talks to one origin and the auth cookies work identically in both places.
const AUTH_API = process.env.AUTH_API_URL ?? "http://127.0.0.1:8001";
const PLACEMENT_API = process.env.PLACEMENT_API_URL ?? "http://127.0.0.1:8002";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${AUTH_API}/:path*` },
      { source: "/api/placement/:path*", destination: `${PLACEMENT_API}/:path*` },
    ];
  },
};

export default nextConfig;
