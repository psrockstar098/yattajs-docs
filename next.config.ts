import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // partialPrefetching: true,
  // cacheComponents: true,
  async redirects() {
    return [
      // Removed in the v1.0 backend-first refactor (2026-10-07) — Google flagged both as 404s in Search Console.
      // Send visitors to the nearest surviving page instead of a dead end.
      {
        source: "/docs/client",
        destination: "/docs/api",
        permanent: true,
      },
      {
        source: "/docs/frontend",
        destination: "/docs/examples/fullstack-next",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
