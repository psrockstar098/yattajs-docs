import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Time series — YATTA Docs",
  description:
    "Time-series tables with a time-ordered index, and rollup policies that summarize old rows into hourly, daily, or weekly summary tables.",
};

export default function TimeSeriesDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Time series" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Rows that arrive stamped with a time — sensor readings, request logs, usage counters. Mark the timestamp column and the table gets a time-ordered index; add a rollup policy and old rows are summarized so recent data stays detailed and old data stays small.">
        Time series
      </H1>

      <H2>Marking a timestamp column</H2>

      <P>
        A time-series table is an ordinary table. Marking its timestamp column
        with <Code>.timeSeries()</Code> gives it a dedicated index on that
        column at schema sync, so time-ordered reads and range scans use the
        index instead of sorting the whole table.
      </P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { createDatabase, col } from "yatta.js/db";

export const schema = {
  readings: {
    id: col.id(),
    at: col.integer().timeSeries(),
    region: col.text(),
    value: col.real(),
  },
};

const db = createDatabase({ path: "Database/app.db", schema });`}
      />

      <P>
        Mark exactly one timestamp column per table — two marked columns are
        rejected at schema sync, because a rollup would not know which one is
        the time axis. Integer milliseconds since epoch and ISO text
        timestamps can both be marked; only integer timestamps can be rolled
        up (see below). A table with no marked column is untouched: its write
        path is exactly the existing one.
      </P>

      <H2>Reading in time order</H2>

      <P>
        Reading is the ordinary query path — the index just makes it fast.
      </P>

      <CodeBlock
        title="Recent rows first"
        code={`const recent = db.readings.findMany({
  orderBy: { at: "desc" },
  take: 100,
});`}
      />

      <H2>Rollup policies</H2>

      <P>
        A policy names a source table, numeric measure columns, optional group
        columns, and one tier per bucket size. Each tier writes one summary row
        per bucket (and per group) holding the row count plus the sum, average,
        minimum, and maximum of each measure.
      </P>

      <CodeBlock
        title="Summarizing old rows"
        code={`import { runRollupPolicy, readRollup } from "yatta.js/timeseries";

const policy = {
  source: "readings",
  measures: ["value"],
  groupBy: ["region"],
  tiers: [
    { name: "hourly", window: "hour", olderThan: "30d" },
    { name: "daily", window: "day", olderThan: "90d" },
  ],
};

// Summarize every complete window older than each tier's cutoff.
runRollupPolicy(db, policy);

// Read a tier's summary table, oldest bucket first.
const hours = readRollup(db, policy, "hourly", {
  from: Date.now() - 7 * 86400_000,
});`}
      />

      <H3>Policy fields</H3>

      <Props
        items={[
          { name: "source", desc: "Table holding the raw time-series rows." },
          { name: "timeColumn", desc: "Timestamp column in milliseconds since epoch. Defaults to the table's .timeSeries() column." },
          { name: "measures", desc: "Numeric columns to summarize with count, sum, average, min, and max." },
          { name: "groupBy", desc: "Low-cardinality dimension columns kept as-is in each summary row." },
          { name: "tiers", desc: "Tiers to run, in the order given. Each tier runs in its own transaction." },
        ]}
      />

      <H3>Tier fields</H3>

      <Props
        items={[
          { name: "name", desc: "Tier name, used in the default summary table name (<source>_<name>)." },
          { name: "window", desc: "Bucket size: \"minute\", \"hour\", \"day\", or \"week\"." },
          { name: "olderThan", desc: "Only rows older than this are rolled up, e.g. \"30d\" or milliseconds." },
          { name: "deleteRaw", desc: "Delete the raw rows a window covers once summarized. Default false — see the gotcha below." },
          { name: "rollupTable", desc: "Summary table name. Defaults to <source>_<name>, e.g. readings_hourly." },
        ]}
      />

      <P>
        A tier only summarizes complete windows: a window is rolled up once
        its end sits at or before the cutoff (<Code>now - olderThan</Code>), so
        a window still receiving rows is never summarized early. Rows in an
        incomplete window wait for a later run.
      </P>

      <P>
        Durations are milliseconds or a string with a unit:{" "}
        <Code>ms</Code>, <Code>s</Code>, <Code>m</Code>, <Code>h</Code>,{" "}
        <Code>d</Code>, <Code>w</Code> — for example <Code>&quot;30d&quot;</Code>.
      </P>

      <H2>Reading summaries</H2>

      <P>
        Summary tables are plain SQLite tables, created on first use. A
        summary row holds <Code>bucket_start</Code>, <Code>bucket_end</Code>,{" "}
        <Code>row_count</Code>, one column per group, and{" "}
        <Code>&lt;measure&gt;_sum</Code>, <Code>&lt;measure&gt;_avg</Code>,{" "}
        <Code>&lt;measure&gt;_min</Code>, <Code>&lt;measure&gt;_max</Code> per
        measure.
      </P>

      <CodeBlock
        title="Reading a tier"
        code={`// Oldest bucket first; empty when nothing has been rolled up yet.
const hours = readRollup(db, policy, "hourly", {
  from: Date.now() - 7 * 86400_000,
  where: { region: "north" },
  limit: 100, // defaults to 1000
});

// Or query the summary table directly — it is a plain table.
const rows = db.unsafeTable("readings_hourly").findMany({
  where: { region: "north" },
  orderBy: { bucket_start: "asc" },
});`}
      />

      <Note>
        <Code>readRollup</Code> filters only on group columns of the policy —
        filtering by anything else throws. A <Code>null</Code> group value
        matches rows whose group was <Code>NULL</Code>.
      </Note>

      <H2>Policies from a config file</H2>

      <P>
        A policy kept in a file can be written as JSON5 instead of strict
        JSON, so comments and trailing commas stay legal. Plain JSON parses
        too, since JSON5 is a superset of it.
      </P>

      <CodeBlock
        title="rollups.json5"
        code={`{
  // Summarize old readings by the hour.
  source: "readings",
  measures: ["value"],
  groupBy: ["region"],
  tiers: [
    { name: "hourly", window: "hour", olderThan: "30d" },
  ],
}`}
      />

      <CodeBlock
        code={`import { parseRollupPolicyConfig } from "yatta.js/timeseries";
import { readFileSync } from "node:fs";

const policy = parseRollupPolicyConfig(readFileSync("rollups.json5", "utf8"));
runRollupPolicy(db, policy);`}
      />

      <P>
        Parsing only parses: the policy is validated against the schema when
        it runs, and a bad policy throws before any table is created or row is
        touched.
      </P>

      <H2>Running policies on a schedule</H2>

      <P>
        Policies run through the existing cron subsystem. Nothing is scheduled
        until the app calls this.
      </P>

      <CodeBlock
        code={`import { createCron } from "yatta.js/jobs";
import { scheduleRollupPolicy } from "yatta.js/timeseries";

const cron = createCron();
scheduleRollupPolicy(cron, db, policy); // hourly by default: "0 * * * *"
scheduleRollupPolicy(cron, db, policy, { interval: "6h" }); // or a fixed interval`}
      />

      <P>
        The cron scheduler skips a run that is still in progress rather than
        overlapping it, and logs a failed run instead of stopping the schedule.
      </P>

      <H2>Re-running never double-counts</H2>

      <P>
        Each tier run deletes a window&apos;s summary rows and re-inserts them
        inside one transaction for the tier, so re-running the same window
        replaces its summaries instead of adding to them. A crash mid-run
        rolls the whole tier back to its previous state: no half-written
        windows, no half-deleted raw rows. A later tier failing leaves earlier
        tiers&apos; work in place.
      </P>

      <P>
        This also covers late-arriving old rows: a row that lands in an
        already summarized window is picked up by the next run, which replaces
        that window&apos;s summary with the corrected one.
      </P>

      <H2>Gotchas</H2>

      <Callout kind="warn">
        Raw deletion is opt-in only. A policy aggregates without deleting
        unless a tier says <code>deleteRaw: true</code> — and only the rows
        inside windows the tier just summarized. Recent rows and rows in
        incomplete windows are never touched. There is no undo: once raw rows
        are deleted, only their summaries remain. Deletion happens in the same
        transaction as the summary insert, so a failed run deletes nothing.
      </Callout>

      <CodeBlock
        title="Deleting raw rows — explicit only"
        code={`// DANGER: this tier deletes the raw rows it summarizes.
const policy = {
  source: "readings",
  measures: ["value"],
  tiers: [{ name: "hourly", window: "hour", olderThan: "30d", deleteRaw: true }],
};`}
      />

      <P>
        <strong>Rollups need integer timestamps.</strong> The bucket math
        divides integer timestamps. A <Code>.timeSeries()</Code> column holding
        ISO text (for example from <Code>col.createdAt()</Code>) still gets
        its time-ordered index, but a policy over it is rejected: use{" "}
        <Code>col.integer().timeSeries()</Code> for the timestamp a policy
        rolls up, or name an integer time column in the policy&apos;s{" "}
        <Code>timeColumn</Code>.
      </P>

      <P>
        <strong>Months are not a bucket size.</strong> Month buckets have
        uneven lengths, so the tier windows are fixed sizes only:{" "}
        <Code>minute</Code>, <Code>hour</Code>, <Code>day</Code>,{" "}
        <Code>week</Code>. A monthly summary is a <Code>day</Code> tier read
        back and grouped by month by the caller, or a second policy over a{" "}
        <Code>day</Code> summary table.
      </P>

      <P>
        <strong>Changing a policy needs a new summary table.</strong> A
        summary table&apos;s columns come from the policy&apos;s measures and
        groups at creation time. If a table of the same name already holds a
        different shape, the run is refused rather than written into blindly
        — pick a different <Code>rollupTable</Code> for the changed tier.
        Renaming a tier likewise points it at a fresh table; the old table
        stays on disk until dropped by hand.
      </P>

      <P>
        <strong>NULL measures and NULL groups.</strong> Aggregate functions
        skip NULL measures: a row with a NULL measure still counts in{" "}
        <Code>row_count</Code>, but contributes nothing to sum, average, min,
        or max. A NULL group summarizes into a single row with a NULL group
        value.
      </P>

      <P>
        <strong>One summary table per tier.</strong> Two tiers must not share
        a <Code>rollupTable</Code>: a tier run deletes by bucket start before
        re-inserting, and bucket starts overlap across window sizes, so
        sharing would delete the other tier&apos;s rows. Policies are
        validated up front and a shared table is rejected before anything
        runs.
      </P>

      <Note>
        Time-series support is fully opt-in. Tables without the marker take
        the exact existing write path: no extra index, no extra statement, no
        rollup table. No policy means no job, no schedule, and no import cost
        — the database module never imports the rollup module, so an app that
        never imports it pays nothing for it.
      </Note>

      <DocFooter
        prev={{ href: "/docs/full-text-search", title: "Full-text search" }}
        next={{ href: "/docs/standalone-build", title: "Standalone binary" }}
      />
    </article>
  );
}
