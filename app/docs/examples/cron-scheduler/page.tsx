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
  title: "Cron scheduler — YATTA Examples",
  description:
    "Scheduled jobs with overlap locking, jitter, misfire handling and graceful shutdown.",
};

export default function CronSchedulerExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Cron scheduler" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Scheduled work that does not double-run, does not stampede, and survives a restart.">
        Cron scheduler
      </H1>

      <H2 id="overlap">The overlap problem</H2>

      <P>A nightly job that takes 40 minutes on a 30-minute schedule will run twice by morning. A lease taken atomically is the only reliable guard.</P>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`import { createCron } from "yatta/jobs";
import { jobs } from "./jobs";

export const cron = createCron(jobs);

/**
 * Take a lease, or report that it is already held.
 *
 * The insert carries the condition, so the database decides the winner. A
 * read-then-write here reintroduces the race the lease exists to prevent.
 */
export function tryAcquire(name: string, ttlMs: number): string | null {
  const now = Date.now();

  const row = db.run(
    \`INSERT INTO cron_leases (name, expires_at)
     VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET
       token = excluded.token,
       expires_at = excluded.expires_at
     WHERE cron_leases.expires_at <= ?
     RETURNING token\`,
    [name, now + ttlMs, now],
    "get",
  );

  return row?.token ?? null;
}

export function release(name: string, token: string): void {
  // Only the holder may release; a stale holder must not clear a live lease.
  db.run(\`DELETE FROM cron_leases WHERE name = ? AND token = ?\`, [name, token]);
}`}
      />

      <H2 id="schedule">Schedule with jitter</H2>

      <P>Every tenant&rsquo;s digest fires at 09:00 exactly, which is a thundering herd against your own database. Jitter spreads the load with no coordination.</P>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`export interface ScheduleOptions {
  /** Spread starts across this many milliseconds. */
  jitterMs?: number;
  /** Run even if the previous run is still going. */
  allowOverlap?: boolean;
  /** Skip rather than queue when a run is missed. */
  misfirePolicy?: "skip" | "catch-up";
}

cron.schedule("0 9 * * *", async (ctx) => {
  const jitter = ctx.options.jitterMs ?? 0;
  if (jitter > 0) {
    await Bun.sleep(Math.floor(Math.random() * jitter));
  }

  const token = allowOverlap
    ? null
    : tryAcquire("daily-digest", 30 * 60_000);

  if (!allowOverlap && !token) {
    // Already running. Log and move on rather than queueing behind it.
    observer.log.warn("Skipped daily-digest: previous run still active");
    return;
  }

  try {
    const users = await db.users.all();

    for (const user of users) {
      await jobs.enqueue("todo-digest", { userId: user.id }, { priority: "low" });
    }
  } finally {
    // Always release, including on a throw. A leaked lease blocks the next run
    // for its whole TTL.
    if (token) release("daily-digest", token);
  }
}, { jitterMs: 10 * 60_000 } satisfies ScheduleOptions);`}
      />

      <H2 id="sweep">Reap dead leases</H2>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`/**
 * A process killed mid-run leaves its lease behind. Sweep expired ones on a
 * short interval so a crash costs a TTL, not a day.
 */
cron.schedule("*/5 * * * *", async () => {
  const purged = db.run(
    \`DELETE FROM cron_leases WHERE expires_at <= ? RETURNING name\`,
    [Date.now()],
    "all",
  );

  if (purged.length > 0) {
    observer.log.warn("Reaped expired cron leases", { count: purged.length });
  }
});`}
      />

      <H2 id="timezone">Timezones</H2>

      <P>Cron is evaluated in the server&rsquo;s local time. If the server is UTC and your users are not, schedule by UTC and convert explicitly.</P>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`/** 09:00 in the user's own timezone, expressed as a UTC hour. */
function utcHourFor(localHour: number, timeZone: string, at = new Date()): number {
  const local = new Date(at.toLocaleString("en-US", { timeZone }));
  const offsetMinutes = (local.getTime() - at.getTime()) / 60_000;
  return (localHour - Math.round(offsetMinutes / 60) + 24) % 24;
}

// One schedule per distinct offset, not per user.
const buckets = new Map<number, string[]>();
for (const user of users) {
  const hour = utcHourFor(prefs.digestHour, prefs.timeZone);
  buckets.set(hour, [...(buckets.get(hour) ?? []), user.id]);
}

for (const [hour, ids] of buckets) {
  cron.schedule(\`\${hour} * * * *\`, async () => {
    for (const userId of ids) {
      await jobs.enqueue("todo-digest", { userId }, { priority: "low" });
    }
  });
}`}
      />

      <Callout kind="tip">Group users by hour and schedule once per bucket. Registering a schedule per user means one timer per user, which does not scale past a few hundred.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/notification-hub", title: "Notification hub" }}
        next={{ href: "/docs/examples/csv-import", title: "CSV import" }}
      />
    </article>
  );
}
