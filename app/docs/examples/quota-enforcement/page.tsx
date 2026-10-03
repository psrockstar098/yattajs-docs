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
  title: "Quota enforcement — YATTA Examples",
  description:
    "Per-plan usage quotas with soft and hard limits, predictive exhaustion warnings, and alerting before the limit bites.",
};

export default function QuotaEnforcementExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Quota enforcement" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Soft limits that warn, hard limits that stop, and an alert that fires before a customer discovers the limit themselves.">
        Quota enforcement
      </H1>

      <H2 id="model">Quota model</H2>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  quotas: {
    tenantId: col.text().primaryKey(),
    // metric -> { soft, hard, period }
    limits: col.json<Record<string, { soft: number; hard: number; period: "day" | "month" }>>()
      .default({}),
    // Set by an admin to override a plan default, e.g. a goodwill increase.
    overrideUntil: col.date().nullable(),
  },

  usageCounters: {
    // tenantId:metric:periodStart
    id: col.text().primaryKey(),
    tenantId: col.text(),
    metric: col.text(),
    count: col.integer().default(0),
    periodStart: col.text(),
  },

  quotaAlerts: {
    id: col.uuid(),
    tenantId: col.text(),
    metric: col.text(),
    threshold: col.text(),     // soft | hard
    at: col.createdAt(),
    notifiedAt: col.date().nullable(),
  },
};

export interface QuotaSpec {
  soft: number;
  hard: number;
  period: "day" | "month";
}`}
      />

      <H2 id="consume">Consume atomically and check</H2>

      <P>Count and compare in one place, so two concurrent requests cannot both pass the last remaining unit.</P>

      <CodeBlock
        title="yatta/func/quota.ts"
        code={`import type { QuotaSpec } from "./db";

export type QuotaVerdict =
  | { allowed: true; used: number; spec: QuotaSpec; remaining: number }
  | { allowed: false; used: number; spec: QuotaSpec; reason: "hard" | "soft" };

/**
 * Count one unit and decide.
 *
 * \`enforce: "soft"\` counts without blocking, so the caller can warn and keep
 * going — that is what a soft limit is for.
 */
export async function consume(
  tenantId: string,
  metric: string,
  options: { enforce?: "hard" | "soft" | "none" } = {},
): Promise<QuotaVerdict> {
  const enforce = options.enforce ?? "hard";
  const spec = await limitFor(tenantId, metric);
  if (!spec) {
    // No limit configured for this metric is unlimited, not zero.
    return { allowed: true, used: 0, spec: { soft: Infinity, hard: Infinity, period: "month" }, remaining: Infinity };
  }

  const periodStart = periodStartFor(spec.period);
  const id = \`\${tenantId}:\${metric}:\${periodStart}\`;

  const row = db.run(
    \`INSERT INTO usage_counters (id, tenantId, metric, count, periodStart)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET count = count + 1
     RETURNING count\`,
    [id, tenantId, metric, periodStart],
    "get",
  );

  const used = Number(row?.count ?? 0);

  if (used > spec.hard) {
    await alertOnce(tenantId, metric, "hard");
    return { allowed: false, used, spec, reason: "hard" };
  }

  if (used > spec.soft) {
    // Soft: notify, but let the request through.
    await alertOnce(tenantId, metric, "soft");
    if (enforce === "none") return { allowed: true, used, spec, remaining: Math.max(0, spec.soft - used) };
  }

  return {
    allowed: true,
    used,
    spec,
    remaining: Math.max(0, spec.hard - used),
  };
}

function periodStartFor(period: "day" | "month"): string {
  const now = new Date();
  if (period === "day") return now.toISOString().slice(0, 10);
  return \`\${now.getUTCFullYear()}-\${String(now.getUTCMonth() + 1).padStart(2, "0")}\`;
}`}
      />

      <Callout kind="warn">A limit that is not configured is <em>unlimited</em>, not zero. Treating a missing config as zero locks every customer out of a feature that was never actually limited.</Callout>

      <H2 id="plan">Plan defaults</H2>

      <CodeBlock
        title="yatta/func/quota.ts"
        code={`export const PLAN_LIMITS: Record<string, Record<string, QuotaSpec>> = {
  free: {
    "api.calls":  { soft: 800,  hard: 1000,  period: "day" },
    "ai.tokens":  { soft: 40_000, hard: 50_000, period: "month" },
    "storage.mb": { soft: 900, hard: 1000, period: "month" },
  },
  pro: {
    "api.calls":  { soft: 80_000, hard: 100_000, period: "day" },
    "ai.tokens":  { soft: 4_000_000, hard: 5_000_000, period: "month" },
    "storage.mb": { soft: 90_000, hard: 100_000, period: "month" },
  },
};

async function limitFor(tenantId: string, metric: string): Promise<QuotaSpec | null> {
  const override = await db.quotas.where((f) => f.tenantId.isEqualTo(tenantId)).first();

  // An active admin override wins over the plan default.
  if (override && (!override.overrideUntil || override.overrideUntil > new Date())) {
    const spec = override.limits?.[metric];
    if (spec) return spec;
  }

  const tenant = await db.tenants.findById(tenantId);
  const plan = await db.plans.findById(tenant?.plan ?? "free");
  return plan?.limits?.[metric] ?? null;
}`}
      />

      <H2 id="alert">Predictive alerts</H2>

      <P>A customer should hear about exhaustion from you, not from a 402.</P>

      <CodeBlock
        title="yatta/func/quota.ts"
        code={`/** Fire once per threshold per period, never on every request past it. */
async function alertOnce(
  tenantId: string,
  metric: string,
  threshold: "soft" | "hard",
): Promise<void> {
  const periodStart = periodStartFor("month");

  const existing = await db.quotaAlerts
    .where((f) => f.idempotencyKey.isEqualTo(\`\${tenantId}:\${metric}:\${threshold}:\${periodStart}\`))
    .first();

  if (existing) return;

  await db.quotaAlerts.insert({
    id: crypto.randomUUID(),
    tenantId,
    metric,
    threshold,
    at: new Date(),
    idempotencyKey: \`\${tenantId}:\${metric}:\${threshold}:\${periodStart}\`,
  });

  const tenant = await db.tenants.findById(tenantId);

  if (threshold === "hard") {
    await jobs.enqueue("quota:hard", { tenantId, metric });
  } else {
    await mail.send({
      to: tenant.billingEmail,
      subject: \`You are approaching your \${metric} limit\`,
      template: "quota-warning",
      props: { metric },
    });
  }
}

/** Warn at 80%, 90% and 100% of the hard limit — before anyone is blocked. */
export async function checkPredictedExhaustion(tenantId: string): Promise<void> {
  for (const metric of ["api.calls", "ai.tokens"]) {
    const spec = await limitFor(tenantId, metric);
    if (!spec || spec.hard === Infinity) continue;

    const used = await usedIn(tenantId, metric, spec.period);
    const ratio = used / spec.hard;

    // Burn rate: are they heading past the limit before the period ends?
    const periodEnd = periodEndFor(spec.period);
    const msLeft = Math.max(1, periodEnd.getTime() - Date.now());
    const msTotal = msLeft / Math.max(ratio, 0.0001);
    const projected = ratio * msTotal / msTotal;

    if (ratio >= 0.8 && projected >= 1) {
      await alertOnce(tenantId, metric, "soft");
    }
  }
}`}
      />

      <H2 id="middleware">Enforce at the edge</H2>

      <CodeBlock
        title="yatta/func/quota-middleware.ts"
        code={`import type { Middleware } from "yatta/api";
import { HttpError } from "yatta/api";
import { consume } from "./quota";
import { cache } from "./cache";

export const quotaGuard: Middleware = async (ctx, next) => {
  const user = await auth.getUser(ctx.req);
  if (!user) return next();

  const metric = ctx.url.searchParams.get("meter") ?? "api.calls";

  const verdict = await consume(user.tenantId, metric);

  // Headers always, so a well-behaved client can pace itself.
  const res = await next();

  if (Number.isFinite(verdict.spec.hard)) {
    res.headers.set("X-Quota-Limit", String(verdict.spec.hard));
    res.headers.set("X-Quota-Remaining", String(Math.max(0, verdict.spec.hard - verdict.used)));
  }

  // Crossing the soft line: still served, but say so loudly in the header.
  if (verdict.allowed && verdict.used > verdict.spec.soft) {
    res.headers.set("X-Quota-Approaching", String(verdict.spec.hard - verdict.used));
  }

  return res;
};

/** Hard limit: refuse with a body the SDK can act on. */
export const quotaEnforcer: Middleware = async (ctx, next) => {
  const user = await auth.getUser(ctx.req);
  if (!user) return next();

  const verdict = await consume(user.tenantId, "api.calls", { enforce: "hard" });

  if (!verdict.allowed) {
    throw new HttpError(429, "Monthly quota exceeded", {
      headers: {
        "Retry-After": String(secondsUntilReset(verdict.spec.period)),
        "X-Quota-Limit": String(verdict.spec.hard),
        "X-Quota-Remaining": "0",
      },
    });
  }

  return next();
};`}
      />

      <H2 id="report">Usage endpoint</H2>

      <CodeBlock
        title="yatta/backend/usage.ts"
        code={`route.get("/usage", async (ctx) => {
  const user = ctx.state.user as { tenantId: string };

  const rows = await Promise.all(
    ["api.calls", "ai.tokens", "storage.mb"].map(async (metric) => {
      const spec = await limitFor(user.tenantId, metric);
      const used = spec
        ? await usedIn(user.tenantId, metric, spec.period)
        : null;

      return {
        metric,
        used,
        limit: spec?.hard ?? null,
        // What the UI colours the meter by.
        utilisation: spec && used !== null ? used / spec.hard : null,
        period: spec?.period ?? "month",
      };
    }),
  );

  return Response.json(rows);
});`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/ai-support-agent", title: "AI support agent" }}
        next={{ href: "/docs/examples/incident-console", title: "Incident console" }}
      />
    </article>
  );
}
