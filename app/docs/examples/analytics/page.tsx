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
  title: "Product analytics — YATTA Examples",
  description:
    "Event analytics and funnels on SQLite: a recording endpoint, rollup tables, and pre-aggregated queries that stay fast.",
};

export default function AnalyticsExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Product analytics" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Recording events cheaply and querying them fast, without a second database.">
        Product analytics
      </H1>

      <H2 id="record">Record</H2>

      <P>The endpoint must be fast and forgiving. A slow analytics call on the request path is how an analytics system becomes an outage.</P>

      <CodeBlock
        title="yatta/backend/events.ts"
        code={`import { createAPI } from "yatta/api";
import { realtime } from "../func/realtime";
import { withSession } from "../func/middleware";

const route = createAPI("/events");

route.use(withSession);

route.post("/", async (ctx) => {
  const user = ctx.state.user as { id: string };
  const body = await ctx.json();

  // Accept and queue. Never await analytics inside a request handler.
  await jobs.enqueue("event:record", {
    userId: user.id,
    name: String(body.name).slice(0, 64),
    props: body.props ?? {},
    sessionId: ctx.cookies().sid ?? null,
  }, { priority: "low" });

  // Live counters via SSE, so an internal dashboard updates without polling.
  realtime.to("analytics:live").send("event.received", {
    name: body.name, at: Date.now(),
  });

  return new Response(null, { status: 202 });
});`}
      />

      <H2 id="storage">Raw and rolled up</H2>

      <P>Querying raw events gets slow at about a million rows. Roll daily aggregates into their own table and query those instead.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  events: {
    id: col.uuid(),
    userId: col.text().nullable(),
    sessionId: col.text().nullable(),
    name: col.text(),
    props: col.json<Record<string, unknown>>().default({}),
    at: col.createdAt(),
  },

  // One row per (day, name, prop). Pre-aggregated, so a query touches
  // thousands of rows rather than millions.
  eventRollups: {
    day: col.text(),              // YYYY-MM-DD
    name: col.text(),
    prop: col.text(),             // "" for no prop
    value: col.text(),
    count: col.integer(),
  },
};`}
      />

      <H2 id="rollup">Aggregate</H2>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`cron.schedule("5 0 * * *", async () => {
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString().slice(0, 10);

  // ON CONFLICT DO UPDATE makes this idempotent: re-running the rollup for a
  // day replaces it rather than double-counting.
  db.run(
    \`INSERT INTO event_rollups (day, name, prop, value, count)
     SELECT ?, name, '', '', COUNT(*)
       FROM events
      WHERE substr(at, 1, 10) = ?
      GROUP BY name
     ON CONFLICT(day, name, prop, value)
       DO UPDATE SET count = count + excluded.count\`,
    [yesterday, yesterday],
  );

  // Same shape for the one prop that matters most, here: the plan.
  db.run(
    \`INSERT INTO event_rollups (day, name, prop, value, count)
     SELECT ?, name, 'plan',
            COALESCE(json_extract(props, '$.plan'), 'unknown'),
            COUNT(*)
       FROM events
      WHERE substr(at, 1, 10) = ? AND name = 'checkout.completed'
      GROUP BY name, value
     ON CONFLICT(day, name, prop, value)
       DO UPDATE SET count = count + excluded.count\`,
    [yesterday, yesterday],
  );

  observer.log.info("Rolled up analytics", { day: yesterday });
});`}
      />

      <H2 id="query">Query</H2>

      <CodeBlock
        title="yatta/backend/analytics.ts"
        code={`import { cache } from "../func/cache";

route.get("/summary", async (ctx) => {
  const days = Number(ctx.query().days ?? 30);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString().slice(0, 10);

  return Response.json(
    await cache.remember(
      \`analytics:summary:\${days}\`,
      async () => {
        const rows = db.run(
          \`SELECT name, SUM(count) AS total
             FROM event_rollups
            WHERE day >= ? AND prop = ''
            GROUP BY name
            ORDER BY total DESC\`,
          [since],
          "all",
        );
        return { days, events: rows };
      },
      // Safe to cache for a minute: a dashboard does not need second-level
      // freshness, and this keeps a popular route off the database.
      { ttl: "60s", tags: ["analytics"] },
    ),
  );
});`}
      />

      <H2 id="funnel">A funnel</H2>

      <CodeBlock
        title="yatta/backend/analytics.ts"
        code={`const FUNNEL = ["signup", "onboarding", "first_project", "invite_teammate"];

route.get("/funnel", async (ctx) => {
  const days = Number(ctx.query().days ?? 30);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString().slice(0, 10);

  const rows = db.run(
    \`SELECT name, SUM(count) AS total
       FROM event_rollups
      WHERE day >= ? AND prop = '' AND name IN (\${FUNNEL.map(() => "?").join(",")})
      GROUP BY name\`,
    [since, ...FUNNEL],
    "all",
  );

  const counts = Object.fromEntries(rows.map((r) => [r.name, Number(r.total)]));

  // Each step is relative to the first, so the drop-off is readable directly.
  const top = counts[FUNNEL[0]] ?? 0;

  return Response.json({
    steps: FUNNEL.map((name, i) => ({
      name,
      count: counts[name] ?? 0,
      // Conversion from the previous step, which is what locates the leak.
      stepConversion: i === 0
        ? 1
        : (counts[name] ?? 0) / Math.max(counts[FUNNEL[i - 1]] ?? 0, 1),
      overallConversion: (counts[name] ?? 0) / Math.max(top, 1),
    })),
  });
});`}
      />

      <Callout kind="tip">Roll up with <code>ON CONFLICT DO UPDATE SET count = count + excluded.count</code> so a re-run is additive and a partial re-run is safe. Deleting and re-inserting means a crash mid-rollup loses the day.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/csv-import", title: "CSV import" }}
        next={{ href: "/docs/examples", title: "Examples" }}
      />
    </article>
  );
}
