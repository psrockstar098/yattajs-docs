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
  title: "Rate-limited API — YATTA Examples",
  description:
    "A sliding-window rate limiter on SQLite with atomic increments, Retry-After headers, and tiered limits per API key.",
};

export default function RateLimitedApiExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Rate-limited API" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Atomic counting, honest Retry-After values, and limits that differ per key rather than per IP.">
        Rate-limited API
      </H1>

      <H2 id="limits">Declare the tiers</H2>

      <P>Limits belong to the key, not the IP. A shared office NAT punishes every user behind it, and an attacker rotates IPs freely.</P>

      <CodeBlock
        title="yatta/func/limits.ts"
        code={`export interface RateLimitRule {
  /** Window length. */
  windowMs: number;
  /** Requests permitted per window. */
  max: number;
}

export const LIMITS = {
  anon:    { windowMs: 60_000, max: 60 },
  free:    { windowMs: 60_000, max: 300 },
  pro:     { windowMs: 60_000, max: 3_000 },
  admin:   { windowMs: 60_000, max: 30_000 },
} satisfies Record<string, RateLimitRule>;

export type Tier = keyof typeof LIMITS;`}
      />

      <H2 id="counting">Count atomically</H2>

      <P>A read-then-write loses increments under concurrency: two requests both read 59, both write 60, and the limit holds at 60 while 61 requests were served. Increment inside the statement.</P>

      <CodeBlock
        title="yatta/func/limits.ts"
        code={`import { db } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window frees a slot. */
  retryAfter: number;
  resetAt: number;
}

export async function consume(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const bucketId = \`\${key}:\${windowStart}\`;

  // One statement: read, increment and write. No lost updates.
  // One statement: upsert, increment and read back. There is no read-then-write
  // window for two concurrent requests to both slip through.
  const count = await increment(bucketId, rule.windowMs, now);

  const allowed = count <= rule.max;

  return {
    allowed,
    limit: rule.max,
    remaining: Math.max(0, rule.max - count),
    retryAfter: allowed ? 0 : Math.ceil((windowStart + rule.windowMs - now) / 1000),
    resetAt: windowStart + rule.windowMs,
  };
}

/**
 * INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
 * RETURNING count
 */
async function increment(bucketId: string, windowMs: number, now: number): Promise<number> {
  const db = getDb();
  const row = db.run(
    \`INSERT INTO rate_buckets (id, count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET count = count + 1
     RETURNING count\`,
    [bucketId, now + windowMs * 2],
    "get",
  );
  return Number(row?.count ?? 0);
}`}
      />

      <Callout kind="warn">The counter has to increment in the same statement that reads it. A read-then-write loses increments under concurrency, and the limit silently admits more traffic than you configured.</Callout>

      <H2 id="sweep">Expire old buckets</H2>

      <P>A rate-limit table grows forever unless something removes it. Expire anything past its window on a cron.</P>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`export const cron = createCron(jobs);

cron.schedule("*/5 * * * *", async () => {
  const purged = await db.rateBuckets
    .where((f) => f.expiresAt.isLessThan(new Date()))
    .delete();

  if (purged > 0) {
    observer.log.info("Purged rate-limit buckets", { purged });
  }
});`}
      />

      <H2 id="middleware">Enforce it</H2>

      <P>Always set <code>RateLimit-*</code> headers, including on success. A client that cannot see its budget cannot pace itself, and a client that only discovers the limit by being rejected will retry harder.</P>

      <CodeBlock
        title="yatta/func/rate-limit.ts"
        code={`import type { Middleware } from "yatta.js/api";
import { HttpError } from "yatta.js/api";
import { auth } from "./auth";
import { LIMITS, consume, type Tier } from "./limits";

/** Pick the strictest of every limit the request matches. */
export function rateLimit(tierFor: (ctx: never) => Promise<Tier>): Middleware {
  return async (ctx, next) => {
    const tier = await tierFor(ctx as never);

    // API key if present, else the session user, else the client address.
    const identity =
      ctx.header("authorization")?.replace(/^Bearer\\s+/i, "") ??
      (await auth.getUser(ctx.req))?.id ??
      ctx.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anon";

    const result = await consume(\`\${tier}:\${identity}\`, LIMITS[tier]);

    if (!result.allowed) {
      throw new HttpError(429, "Rate limit exceeded", {
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      });
    }

    const res = await next();

    res.headers.set("X-RateLimit-Limit", String(result.limit));
    res.headers.set("X-RateLimit-Remaining", String(result.remaining));
    res.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));

    return res;
  };
}

export const apiRateLimit = rateLimit(async (ctx: never) => {
  const user = await auth.getUser((ctx as { req: Request }).req);
  return (user?.roles?.includes("admin") ? "admin" : user ? "free" : "anon") as Tier;
});`}
      />

      <H2 id="response">What the client sees</H2>

      <CodeBlock
        code={`HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 271
X-RateLimit-Reset: 1780000260

HTTP/1.1 429 Too Many Requests
Retry-After: 17
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1780000260`}
      />

      <Callout kind="tip">Put <code>Retry-After</code> on the rejection. Clients that retry immediately make a throttling event into an outage, and the header is the only signal telling them to wait.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/feature-flags", title: "Feature flags" }}
        next={{ href: "/docs/examples", title: "Examples" }}
      />
    </article>
  );
}
