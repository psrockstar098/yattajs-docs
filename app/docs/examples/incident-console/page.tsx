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
  title: "Incident console — YATTA Examples",
  description:
    "An on-call console built on the framework's own observability: live issues, a trace waterfall, deploy correlation and alerting.",
};

export default function IncidentConsoleExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Incident console" },
        ]}
      />

      <H1 eyebrow="Examples" sub="The operations UI you would otherwise write by hand — assembled from tracing, metrics, issues and one query per panel.">
        Incident console
      </H1>

      <H2 id="overview">The overview panel</H2>

      <P>One call answers &ldquo;is anything on fire&rdquo;. Cheap enough to poll every few seconds because it reads a bounded in-process buffer.</P>

      <CodeBlock
        title="yatta/backend/ops/overview.ts"
        code={`import { createAPI } from "yatta.js/api";
import { observer } from "../../func/observe";

const route = createAPI("/ops");

route.get("/overview", async () => {
  // getDeepApplicationState is async because it reads live subsystem metrics.
  const o = await observer.getDeepApplicationState();

  // Derive a verdict from the numbers, and say what it is based on.
  const errorRate = o.apdex.total > 0 ? o.errors.count / o.apdex.total : 0;

  return Response.json({
    service: o.service,
    environment: o.environment,
    uptimeSeconds: o.uptimeSeconds,

    health: {
      status:
        o.errors.count > 0 || o.apdex.p95 > 1000 ? "degraded" : "healthy",
      basedOn: \`\${o.apdex.total} recent request(s)\`,
    },

    latency: { p50: o.apdex.p50, p95: o.apdex.p95, p99: o.apdex.p99, apdex: o.apdex.apdex },
    errorRate,
    issues: o.errors,
    subsystems: { database: o.database, queues: o.queues, cache: o.cache },
  });
});`}
      />

      <H2 id="issues">The issue queue</H2>

      <CodeBlock
        title="yatta/backend/ops/issues.ts"
        code={`route.get("/issues", async (ctx) => {
  const status = ctx.query().status ?? "unresolved";

  // issues is the live map; filter rather than reaching for a convenience
  // accessor that does not exist.
  const all = [...observer.errors.issues.values()];
  const issues =
    status === "all" ? all : all.filter((i) => i.status === "unresolved");

  return Response.json({
    stats: observer.errors.stats(),
    issues: issues.map((i) => ({
      fingerprint: i.fingerprint,
      status: i.status,
      name: i.name,
      message: i.message,
      count: i.count,
      usersAffected: i.usersAffected,
      eventsPerHour: i.eventsPerHour,
      firstSeen: i.firstSeen,
      lastSeen: i.lastSeen,
      // "Which deploy broke this" is the question that ends an incident.
      releases: i.releases,
      environments: i.environments,
      routes: i.routes,
    })),
  });
});

/** Triage actions, matching the issue lifecycle. */
for (const action of ["resolve", "ignore", "unresolve"] as const) {
  route.post(\`/issues/:fingerprint/\${action}\`, async (ctx) => {
    const by = ctx.query().by ?? "unknown";
    const issue = observer.errors.applyAction(ctx.params.fingerprint, {
      type: action,
      by,
    });

    if (!issue) throw new HttpError(404, "Unknown issue");

    // Triage is itself an audit event.
    await record({
      tenantId: null,
      actorId: by,
      action: \`issue.\${action}\`,
      target: \`issue:\${issue.fingerprint}\`,
      before: null,
      after: { status: issue.status },
    });

    return Response.json({ status: issue.status });
  });
}`}
      />

      <H2 id="trace">Issue to trace to span</H2>

      <P>An issue links to the trace it came from, a trace links to its spans, and a span links to the logs written inside it. That chain is the whole debugging workflow.</P>

      <CodeBlock
        title="yatta/backend/ops/trace.ts"
        code={`route.get("/traces/:id", async (ctx) => {
  const spans = observer.spans.all().filter((sp) => sp.traceId === ctx.params.id);
  if (spans.length === 0) throw new HttpError(404, "Unknown trace");

  // Assemble the tree the server sends flat.
  const byId = new Map(spans.map((s) => [s.spanId, { ...s, children: [] as string[] }]));
  let root = spans[0].spanId;

  for (const span of spans) {
    if (!span.parentSpanId) { root = span.spanId; continue; }
    byId.get(span.parentSpanId)?.children.push(span.spanId);
  }

  // Waterfall offsets, relative to the trace start.
  const start = Math.min(...spans.map((s) => s.startTime));

  return Response.json({
    traceId: ctx.params.id,
    rootSpanId: root,
    startedAt: start,
    totalMs: Math.max(...spans.map((s) => s.endTime ?? s.startTime)) - start,
    spans: spans.map((s) => ({
      ...s,
      offsetMs: s.startTime - start,
      durationMs: (s.endTime ?? Date.now()) - s.startTime,
      depth: depthOf(s.spanId, byId),
      // The link back to an issue, when this span produced one.
      issue: observer.errors
        .filter((i) => i.occurrences.some((o) => o.spanId === s.spanId))
        .map((i) => i.fingerprint),
    })),
  });
});

function depthOf(spanId: string, byId: Map<string, { parentSpanId?: string }>): number {
  let depth = 0;
  let cursor = byId.get(spanId)?.parentSpanId;
  while (cursor && depth < 32) { depth++; cursor = byId.get(cursor)?.parentSpanId; }
  return depth;
}`}
      />

      <H2 id="timeline">Deploy correlation</H2>

      <P>The single most useful panel during an incident: everything that happened, on one time axis.</P>

      <CodeBlock
        title="yatta/backend/ops/timeline.ts"
        code={`route.get("/timeline", async (ctx) => {
  const hours = Math.min(Number(ctx.query().hours ?? 6), 168);
  const since = Date.now() - hours * 3_600_000;

  const issues = [...observer.errors.issues.values()]
    .filter((i) => i.lastSeen > since)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 200);

  const traces = observer.spans.all().filter((sp) => sp.startTime > since);

  const events = [
    // Deploys come from the release field, not a separate tracker.
    ...releasesSince(since).map((r) => ({
      at: r.deployedAt,
      kind: "deploy" as const,
      label: \`Deploy \${r.release}\`,
      detail: r.author,
    })),

    ...issues.map((i) => ({
      at: i.firstSeen,
      kind: "issue" as const,
      label: \`\${i.name}: \${i.message.slice(0, 80)}\`,
      detail: \`\${i.count} events\`,
      fingerprint: i.fingerprint,
    })),

    // Slow requests, bucketed so the panel is readable.
    ...bucketLatency(traces, since).map((b) => ({
      at: b.at,
      kind: "latency" as const,
      label: \`p95 \${b.p95}ms\`,
      detail: \`\${b.count} traces\`,
    })),

    // AI spend, if any.
    ...observer.spans.all()
      .filter((s) => (s.startTime ?? 0) > since && (s.ai?.costUsd ?? 0) > 0)
      .map((s) => ({
        at: s.startTime ?? 0,
        kind: "ai" as const,
        label: \`\${s.ai?.model}: \${s.ai?.inputTokens}+\${s.ai?.outputTokens} tokens\`,
        detail: \`$\${(s.ai?.costUsd ?? 0).toFixed(4)}\`,
        traceId: s.traceId,
      })),
  ].sort((a, b) => a.at - b.at);

  return Response.json({ since, events });
});`}
      />

      <Callout kind="tip">Putting deploys on the same axis as errors ends most incidents faster than any dashboard: if the first error follows the newest release by four minutes, you already know where to look.</Callout>

      <H2 id="alerts">Alerting</H2>

      <CodeBlock
        title="yatta/func/alerts.ts"
        code={`export interface AlertRule {
  name: string;
  /** Evaluated every 60s against the in-process snapshot. */
  test: () => Promise<boolean>;
  severity: "page" | "ticket";
  notify: string[];
}

export const ALERTS: AlertRule[] = [
  {
    name: "unhandled-errors",
    severity: "page",
    test: async () => (await observer.getDeepApplicationState()).errors.count > 0,
    notify: ["pagerduty"],
  },
  {
    name: "latency-p95",
    severity: "page",
    test: async () => (await observer.getDeepApplicationState()).apdex.p95 > 2000,
    notify: ["pagerduty", "slack"],
  },
  {
    name: "exporter-failing",
    severity: "ticket",
    // You are blind if telemetry is not leaving, so this matters even though
    // it says nothing about the app.
    test: async () => (await observer.getDeepApplicationState()).slowQueries.length > 3,
    notify: ["slack"],
  },
  {
    name: "ai-spend",
    severity: "ticket",
    test: async () => aiSpendToday() > 500,
    notify: ["slack"],
  },
];

/** One cron evaluates every rule; a failing rule must not stop the others. */
export const cron = createCron(jobs);

cron.schedule("* * * * *", async () => {
  for (const rule of ALERTS) {
    try {
      const firing = await rule.test();
      const wasFiring = firingState.has(rule.name);
      if (firing === wasFiring) continue;   // only on edges

      firingState.set(rule.name, firing);

      const snapshotMetrics = async () => {
        const o = await observer.getDeepApplicationState();
        return { errorCount: o.errors.count, p95: o.apdex.p95, apdex: o.apdex.apdex };
      };

      await jobs.enqueue("alert:dispatch", {
        name: rule.name,
        severity: rule.severity,
        state: firing ? "firing" : "resolved",
        snapshot: await snapshotMetrics(),
      });
    } catch (err) {
      observer.log.error("Alert rule failed", { rule: rule.name, err });
    }
  }
});`}
      />

      <Callout kind="warn">Alert on <em>edges</em>, not on state. A rule that fires every minute while a condition is true is how an alert channel becomes something everyone mutes.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/quota-enforcement", title: "Quota enforcement" }}
        next={{ href: "/docs/examples", title: "Examples" }}
      />
    </article>
  );
}
