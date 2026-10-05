// lib/api.ts
//
// Typed access to the generated API surface.
//
// The JSON is produced by scripts/extract-api.mjs, which reads the framework
// source with the TypeScript compiler. Nothing here is hand-written, so a
// signature can never drift from the implementation the way hand-authored
// reference pages do.

import surface from "./api-surface.json";

export type MemberKind = "method" | "property" | "getter" | "setter" | "call" | "member";

export interface Param {
  name: string;
  text: string;
}

export interface Member {
  name: string;
  kind: MemberKind;
  signature: string;
  headline?: boolean;
  summary: string;
  note: string;
  example: string;
  params: Param[];
  returns: string;
}

export interface Entry {
  name: string;
  kind: string;
  signature: string;
  overloads?: string[];
  summary: string;
  note: string;
  example: string;
  params: Param[];
  returns: string;
  members: Member[];
}

export interface Module {
  id: string;
  slug: string;
  label: string;
  blurb: string;
  source: string;
  entries: Entry[];
}

/** Ordering and copy for the reference rail. Kept beside the data it labels. */
const META: Record<string, { slug: string; blurb: string }> = {
  "yatta/runtime": {
    slug: "runtime",
    blurb: "Worker pools, subsystems, crash supervision and drain.",
  },
  "yatta/api": {
    slug: "api",
    blurb: "File-based routing, request context, and validation.",
  },
  "yatta/rpc": {
    slug: "rpc",
    blurb: "Serve a route table, so the server and the client read one definition.",
  },
  "yatta/client": {
    slug: "client",
    blurb: "A typed client built from your routes. No hand-written fetch calls.",
  },
  "yatta/universal": {
    slug: "universal",
    blurb: "One route definition, used two ways: called in process or over HTTP.",
  },
  "yatta/frameworks": {
    slug: "frameworks",
    blurb: "Bindings for Vue, Solid, Svelte, Angular, Qwik, and plain pages.",
  },
  "yatta/frontend": {
    slug: "frontend",
    blurb: "Query cache, realtime state, and environment detection.",
  },
  "yatta/binding": {
    slug: "binding",
    blurb: "The shared reactive contract every framework binding is built on.",
  },
  "yatta/react": {
    slug: "react",
    blurb: "React hooks over the same route table.",
  },
  "yatta/next": {
    slug: "next",
    blurb: "Route handlers and request-scoped fetching for Next.js.",
  },
  "yatta/observe": {
    slug: "observe",
    blurb: "Tracing, metrics, issues, incident analysis and the dashboard.",
  },
  "yatta/path": {
    slug: "path",
    blurb: "Path templates: one parser for the client, the router and the handler.",
  },
  "yatta/batcher": {
    slug: "batcher",
    blurb: "DataLoader batching, so fifty concurrent calls are one query.",
  },
  "yatta/db": {
    slug: "db",
    blurb: "Typed SQLite: schema, relations, queries, migrations.",
  },
  "yatta/auth": {
    slug: "auth",
    blurb: "Passwords, sessions, passkeys, OAuth, 2FA, API keys.",
  },
  "yatta/jobs": {
    slug: "jobs",
    blurb: "Durable queues, retries, dead letters, cron and events.",
  },
  "yatta/cache": {
    slug: "cache",
    blurb: "L1 memory and L2 SQLite caching, singleflight, SWR.",
  },
  "yatta/storage": {
    slug: "storage",
    blurb: "Local and S3 disks, uploads, signed URLs, streaming.",
  },
  "yatta/mail": {
    slug: "mail",
    blurb: "Templates, layouts, transports, and preview sending.",
  },
  "yatta/realtime": {
    slug: "realtime",
    blurb: "WebSockets, SSE, rooms, pub/sub and AI streaming.",
  },
};

export const modules: Module[] = Object.entries(surface)
  .filter(([id]) => id in META)
  .map(([id, mod]) => {
    const meta = META[id];
    return {
      id,
      slug: meta.slug,
      label: mod.label,
      blurb: meta.blurb,
      source: mod.file,
      entries: mod.entries as Entry[],
    };
  });

export const apiModules = modules.map((m) => ({
  slug: m.slug,
  label: m.label,
  blurb: m.blurb,
}));

export function getModule(slug: string): Module | undefined {
  return modules.find((m) => m.slug === slug);
}

/** Counts for the reference index. */
export const totals = {
  modules: modules.length,
  symbols: modules.reduce((n, m) => n + m.entries.length, 0),
  members: modules.reduce(
    (n, m) => n + m.entries.reduce((k, e) => k + e.members.length, 0),
    0,
  ),
};
