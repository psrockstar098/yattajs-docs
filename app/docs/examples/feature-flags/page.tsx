import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Feature flags — YATTA Examples",
  description:
    "Typed feature flags with database storage, an L1 cache, per-user overrides and live updates over SSE.",
};

export default function FeatureFlagsExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Feature flags" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Typed flags, a cache that does not stampede, and updates that reach a running browser without a refresh.">
        Feature flags
      </H1>

      <H2 id="typed">Declare the flag set once</H2>

      <P>A stringly-typed <code>flags.get(&quot;new-checkout&quot;)</code> returns <code>string | undefined</code> and no compiler help. Declaring the set gives you autocompletion and a type error when a flag is renamed.</P>

      <CodeBlock
        title="yatta/func/flags.ts"
        code={`import { col, createDatabase } from "yatta.js/db";
import { createCache } from "yatta.js/cache";

export const FLAG_KEYS = [
  "new-checkout",
  "ai-summaries",
  "dark-mode",
  "usage-billing",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];
export type FlagValue = boolean | number | string;

export const schema = {
  flags: {
    key: col.text().primaryKey(),
    value: col.text(),
    description: col.text().nullable(),
    updatedAt: col.createdAt(),
  },

  // Per-user overrides, so you can enable a flag for yourself before rolling
  // it out to everyone.
  flagOverrides: {
    id: col.uuid(),
    flagKey: col.text(),
    userId: col.text(),
    value: col.text(),
    expiresAt: col.date().nullable(),
  },
};

export const db = createDatabase({ url: process.env.DATABASE_URL, schema });
export const cache = createCache({ maxSize: 500 });`}
      />

      <H2 id="read">Read with singleflight</H2>

      <P><code>cache.remember</code> collapses a burst of concurrent misses into one database read. Without it, a cold flag read on a busy route runs the query once per in-flight request.</P>

      <CodeBlock
        title="yatta/func/flags.ts"
        code={`import { z } from "zod";

const CACHE_TTL = "30s";

function parse(raw: string): FlagValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

/**
 * Resolve one flag: override, then cache, then database.
 */
export async function getFlag(key: FlagKey, userId?: string): Promise<FlagValue> {
  if (userId) {
    const override = await db.flagOverrides
      .where((f) => and(
        f.flagKey.isEqualTo(key),
        f.userId.isEqualTo(userId),
      ))
      .first();

    if (override && (!override.expiresAt || override.expiresAt > new Date())) {
      return parse(override.value);
    }
  }

  return cache.remember(
    \`flag:\${key}\`,
    async () => {
      const row = await db.flags.where((f) => f.key.isEqualTo(key)).first();
      return row ? parse(row.value) : false;
    },
    { ttl: CACHE_TTL, tags: ["flags"] },
  );
}

/** Evaluate many flags in one round trip. */
export async function evaluate(userId?: string): Promise<Record<FlagKey, FlagValue>> {
  const entries = await Promise.all(
    FLAG_KEYS.map(async (k) => [k, await getFlag(k, userId)] as const),
  );
  return Object.fromEntries(entries) as Record<FlagKey, FlagValue>;
}`}
      />

      <H2 id="set">Set and invalidate</H2>

      <CodeBlock
        title="yatta/func/flags.ts"
        code={`import { realtime } from "./realtime";

export async function setFlag(
  key: FlagKey,
  value: FlagValue,
): Promise<void> {
  await db.flags
    .where((f) => f.key.isEqualTo(key))
    .update({ value: String(value), updatedAt: new Date() });

  // One tag invalidates every read for this key, in L1 and L2.
  await cache.invalidateTags("flags");

  // Open browsers apply it without a refresh.
  realtime.to("flags").send("flag.updated", { key, value });
}

/** Give one user a temporary override, e.g. to debug a rollout. */
export async function overrideFor(
  key: FlagKey,
  userId: string,
  value: FlagValue,
  hours = 24,
): Promise<void> {
  await db.flagOverrides.insert({
    flagKey: key,
    userId,
    value: String(value),
    expiresAt: new Date(Date.now() + hours * 3_600_000),
  });
}`}
      />

      <H2 id="client">The browser</H2>

      <CodeBlock
        title="public/flags.js"
        code={`const store = {};

// One socket, not one per flag.
const ws = new WebSocket(\`ws://\${location.host}/ws\`);

ws.addEventListener("message", (e) => {
  const { event, data } = JSON.parse(e.data);
  if (event !== "flag.updated") return;

  store[data.key] = data.value;

  // Re-render whatever subscribed to this flag.
  window.dispatchEvent(
    new CustomEvent("yatta:flag", { detail: data }),
  );
});

window.flags = {
  get: (key) => store[key] ?? false,
  on: (key, fn) => {
    const handler = (e) => {
      if (e.detail.key === key) fn(e.detail.value);
    };
    window.addEventListener("yatta:flag", handler);
    return () => window.removeEventListener("yatta:flag", handler);
  },
};

// Hydrate from the server on first paint so there is no flash of default.
const res = await fetch("/api/flags");
const initial = await res.json();
Object.assign(store, initial);`}
      />

      <Callout kind="tip">Always hydrate from the server on first paint. A flag that is false until the socket opens will flash the wrong UI, which is exactly the kind of bug that gets blamed on the rollout.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/audit-log", title: "Audit log" }}
        next={{ href: "/docs/examples/rate-limited-api", title: "Rate-limited API" }}
      />
    </article>
  );
}
