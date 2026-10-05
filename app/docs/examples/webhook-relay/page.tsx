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
  title: "Webhook relay — YATTA Examples",
  description:
    "Signed outbound webhooks with HMAC verification, exponential-backoff retries, and a dead-letter queue.",
};

export default function WebhookRelayExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Webhook relay" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Signing a payload, retrying a delivery that failed, and not retrying one that will never succeed.">
        Webhook relay
      </H1>

      <H2 id="model">Model</H2>

      <P>A delivery is the unit of work. One event to one endpoint is one delivery with its own attempts, so a slow endpoint cannot hold up the rest.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta.js/db";

export const schema = {
  endpoints: {
    id: col.uuid(),
    tenantId: col.text(),
    url: col.text(),
    secret: col.text(),
    events: col.json<string[]>().default([]),
    active: col.boolean().default(true),
    createdAt: col.createdAt(),
  },

  deliveries: {
    id: col.uuid(),
    endpointId: col.text().references("endpoints.id", { onDelete: "CASCADE" }),
    event: col.text(),
    payload: col.json<Record<string, unknown>>(),
    status: col.text().default("pending"),   // pending | delivered | failed | dead
    attempts: col.integer().default(0),
    lastStatus: col.integer().nullable(),
    lastError: col.text().nullable(),
    nextAttemptAt: col.date().nullable(),
    createdAt: col.createdAt(),
  },
};

export const db = createDatabase({
  url: process.env.DATABASE_URL,
  schema,
});`}
      />

      <H2 id="signing">Sign the payload</H2>

      <P>Sign the raw bytes, not a re-serialised object. JSON key order is not guaranteed, so a receiver that re-serialises will compute a different signature and reject a valid delivery.</P>

      <CodeBlock
        title="yatta/func/webhook-signing.ts"
        code={`import { createHmac, timingSafeEqual } from "node:crypto";

/** t=unix seconds,v1=hex — the shape every provider converges on. */
export function signPayload(secret: string, payload: string, timestamp = Date.now()): string {
  const t = Math.floor(timestamp / 1000);
  const mac = createHmac("sha256", secret).update(\`\${t}.\${payload}\`).digest("hex");
  return \`t=\${t},v1=\${mac}\`;
}

export function verifyPayload(
  secret: string,
  payload: string,
  header: string,
  toleranceSec = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  // Reject a replayed signature even though the MAC still checks out.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
  if (age > toleranceSec) return false;

  const expected = createHmac("sha256", secret)
    .update(\`\${parts.t}.\${payload}\`)
    .digest();

  const received = Buffer.from(parts.v1, "hex");

  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}`}
      />

      <Callout kind="warn">Compare with <code>timingSafeEqual</code>, never <code>===</code>. A string comparison short-circuits on the first differing byte, which leaks the signature one byte at a time.</Callout>

      <H2 id="enqueue">Enqueue from an event</H2>

      <P>One job per delivery. A single job looping over every endpoint holds one lease and retries all-or-nothing.</P>

      <CodeBlock
        title="yatta/func/events.ts"
        code={`import { createEvents } from "yatta.js/jobs";
import { jobs } from "./jobs";

export interface AppEvents {
  "order.paid":    { orderId: string; tenantId: string; amount: number };
  "user.created":  { userId: string; tenantId: string };
}

declare module "yatta.js/jobs" {
  interface EventRegister extends AppEvents {}
}

export const events = createEvents(jobs);

// Fan out to every subscribed endpoint as separate jobs.
events.on("order.paid", async (data) => {
  const endpoints = await db.endpoints
    .where((f) => and(
      f.tenantId.isEqualTo(data.tenantId),
      f.active.isEqualTo(true),
    ))
    .all();

  for (const endpoint of endpoints) {
    if (!endpoint.events.includes("order.paid")) continue;

    await jobs.enqueue("webhook:deliver", {
      endpointId: endpoint.id,
      event: "order.paid",
      payload: data,
    });
  }
});`}
      />

      <H2 id="deliver">Deliver with backoff</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs } from "yatta.js/jobs";
import { signPayload } from "./webhook-signing";

export const jobs = createJobs();

export interface JobHandlers {
  "webhook:deliver": {
    endpointId: string;
    event: string;
    payload: Record<string, unknown>;
  };
}

// 5s, 30s, 2m, 10m, 1h — then dead.
const BACKOFF_MS = [5_000, 30_000, 120_000, 600_000, 3_600_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

jobs.handle("webhook:deliver", async (job, ctx) => {
  const endpoint = await db.endpoints.findById(job.endpointId);
  if (!endpoint?.active) return;   // disabled mid-flight: drop, do not retry

  const delivery = await db.deliveries
    .where((f) => f.endpointId.isEqualTo(endpoint.id))
    .find ?? undefined;

  const attempt = delivery?.attempts ?? 0;

  // Serialise once and reuse the same bytes for both the MAC and the body.
  const body = JSON.stringify({
    id: delivery?.id,
    event: job.event,
    created: new Date().toISOString(),
    data: job.payload,
  });

  const signature = signPayload(endpoint.secret, body);
  const started = Date.now();

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-yatta-signature": signature,
        "x-yatta-event": job.event,
        "x-yatta-delivery": delivery?.id ?? "unknown",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    await db.deliveries
      .where((f) => f.endpointId.isEqualTo(endpoint.id))
      .update({
        attempts: attempt + 1,
        lastStatus: res.status,
        lastError: null,
        status: res.ok ? "delivered" : "failed",
      });

    // 4xx means the request is wrong; retrying cannot fix it.
    if (!res.ok && res.status < 500 && res.status !== 429) {
      ctx.log.warn("Permanent webhook failure", { status: res.status });
    }
  } catch (err) {
    const next = attempt + 1;
    const isPermanent = next >= MAX_ATTEMPTS;

    await db.deliveries
      .where((f) => f.endpointId.isEqualTo(endpoint.id))
      .update({
        attempts: next,
        lastError: err instanceof Error ? err.message : String(err),
        status: isPermanent ? "dead" : "failed",
        nextAttemptAt: new Date(Date.now() + (BACKOFF_MS[next - 1] ?? 0)),
      });

    if (isPermanent) {
      // Terminal: the dead-letter queue owns it from here.
      ctx.log.error("Webhook dead-lettered", { attempts: next });
      return;
    }

    // Re-throw so the queue's own retry applies the delay.
    throw err;
  }

  ctx.progress(100, \`delivered in \${Date.now() - started}ms\`);
});`}
      />

      <Callout kind="tip">Schedule a cron over dead deliveries rather than retrying in-process. Some endpoints recover hours later, and re-queueing from a sweep means a restart does not lose the attempt history.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/multi-tenant", title: "Multi-tenant SaaS" }}
        next={{ href: "/docs/examples/audit-log", title: "Audit log" }}
      />
    </article>
  );
}
