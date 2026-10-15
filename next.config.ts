import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // partialPrefetching: true,
  // cacheComponents: true,
  async redirects() {
    return [
      // Canonical host consolidation (2026-10-15) — Search Console flagged
      // "Duplicate without user-selected canonical" on the yattajs-docs.vercel.app
      // property. The deployment URL and yatta.js.org serve identical content, so
      // send every request on the deployment host to the launch domain and let
      // Google consolidate indexing under yatta.js.org. Preview deployments use
      // unique hashed hosts (*.vercel.app) and are unaffected by the exact match.
      // Kept first so it wins over the path rules below.
      {
        source: "/:path*",
        has: [{ type: "host", value: "yattajs-docs.vercel.app" }],
        destination: "https://yatta.js.org/:path*",
        permanent: true,
      },
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
      // Removed API-reference modules (v1.0 backend-first refactor) — Google flagged as 404s in Search Console.
      // The single yatta/api export absorbed their surface; /docs/api-reference/api is the nearest surviving page.
      {
        source: "/docs/api-reference/rpc",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/client",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/universal",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/frameworks",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/frontend",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/binding",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/path",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/batcher",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/react",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
      {
        source: "/docs/api-reference/next",
        destination: "/docs/api-reference/api",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
