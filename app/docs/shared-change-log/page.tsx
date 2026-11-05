import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Shared change log — YATTA Docs",
  description:
    "One _yatta_outbox table per database file: the single log the outbox relay publishes from today, and replication and time-travel replay read from later.",
};

export default function SharedChangeLogDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Shared change log" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="One log, not three: every database file that needs durable delivery keeps a single _yatta_outbox table in that same file, and the outbox relay, a future replication worker, and a future time-travel replay worker all read from it.">
        Shared change log
      </H1>

      <P>
        The outbox relay publishes from this table today; a future
        replication worker and a future time-travel replay worker read from
        the same table, in the same order, with the same rules. Nothing here
        requires a new table for those later features.
      </P>

      <H2>The rule that makes it work</H2>

      <P>
        Write the change and its log entry in the same transaction, in the
        same file. If the transaction rolls back, both disappear. If it
        commits, both are durable. There is no window where the change exists
        but the event does not, or the other way round.
      </P>

      <CodeBlock
        title="Record through the database object"
        code={`import { createDatabase, col } from "yatta.js/db";

const db = createDatabase({ path: "Database/app.db", schema });

db.transaction((tx) => {
  const user = tx.users.insert({ email: "ada@example.com", name: "Ada" });
  // Same transaction, same file: this row commits or rolls back with the insert.
  tx.recordOutbox({
    eventType: "user.registered",
    aggregateType: "user",
    aggregateId: user.id,
    payload: { userId: user.id, email: user.email },
  });
});`}
      />

      <P>
        The short form does the same thing through the database object —
        <Code>tx.recordOutbox(...)</Code> is a method on the transaction
        proxy, so recording needs no separate import. The underlying
        standalone function, <Code>recordOutbox(store, input)</Code>, lives
        in the outbox module (see the note below on its import path).
      </P>

      <H2>Schema</H2>

      <P>
        Table <Code>_yatta_outbox</Code>, created with{" "}
        <Code>CREATE TABLE IF NOT EXISTS</Code> by{" "}
        <Code>ensureOutboxTable()</Code> (called automatically by{" "}
        <Code>recordOutbox()</Code> and by the relay, so app code never
        creates it by hand). One table per database file:{" "}
        <Code>app.db</Code>, <Code>jobs.db</Code>, <Code>cache.db</Code>, and
        the auth store each get their own log. There is no cross-file
        transaction and no cross-file order.
      </P>

      <Props
        items={[
          { name: "seq", desc: "INTEGER PRIMARY KEY AUTOINCREMENT. Position in this file's log. The only ordering key." },
          { name: "event_id", desc: "TEXT NOT NULL UNIQUE. Stable identity of this event, a UUID by default. The dedupe key." },
          { name: "event_type", desc: "TEXT NOT NULL. What happened, e.g. user.registered. Consumers filter on this." },
          { name: "aggregate_type", desc: "TEXT, nullable. What kind of thing changed, e.g. user. Null when the event has no aggregate." },
          { name: "aggregate_id", desc: "TEXT, nullable. Which thing changed. Together with aggregate_type it selects one aggregate's history." },
          { name: "payload", desc: "TEXT NOT NULL. JSON. The event data. Must be JSON-serializable; anything else is rejected at record time." },
          { name: "occurred_at", desc: "INTEGER NOT NULL. Milliseconds since epoch when the event happened. Defaults to record time; callers may pass an earlier business time." },
          { name: "dedupe_key", desc: "TEXT, nullable, unique when present. Caller-chosen dedupe key, e.g. welcome-email:<userId>. Nulls do not collide." },
          { name: "status", desc: "TEXT NOT NULL. pending, published, or dead. See Lifecycle below." },
          { name: "attempts", desc: "INTEGER NOT NULL. Publish attempts so far. Only the relay increments this." },
          { name: "next_attempt_at", desc: "INTEGER NOT NULL. Earliest time the relay may retry. Pending rows past this time are due." },
          { name: "published_at", desc: "INTEGER, nullable. When the relay marked the row published. Null until then." },
          { name: "last_error", desc: "TEXT, nullable. Last publish failure message, for inspection. Never a secret: do not put credentials in it." },
          { name: "created_at", desc: "INTEGER NOT NULL. Milliseconds since epoch when the row was recorded." },
        ]}
      />

      <P>
        Indexes: <Code>(status, next_attempt_at, seq)</Code> for the relay
        scan, <Code>(event_type, seq)</Code> for event-type consumers, and{" "}
        <Code>(aggregate_type, aggregate_id, seq)</Code> for per-aggregate
        replay. <Code>event_id</Code> and non-null{" "}
        <Code>dedupe_key</Code> are unique indexes.
      </P>

      <H2>Ordering guarantees</H2>

      <UL>
        <LI>
          <Code>seq</Code> is strictly increasing within one file, in commit
          order as far as SQLite assigns it. It is the only order consumers
          may rely on.
        </LI>
        <LI>
          <Code>seq</Code> values may have gaps. A rolled-back transaction
          consumes no published sequence, and a failed insert never appears.
          Consumers must treat a gap as &ldquo;nothing was ever published
          there&rdquo;, never as a missing event to wait for.
        </LI>
        <LI>
          Timestamps do not order the log. <Code>occurred_at</Code> and{" "}
          <Code>created_at</Code> can skew across processes and machines;{" "}
          <Code>seq</Code> cannot.
        </LI>
        <LI>
          There is no total order across files. A consumer reading{" "}
          <Code>app.db</Code> and <Code>jobs.db</Code> sees two independent
          logs. If a future feature needs one merged order, it must define
          it (for example, by per-source cursor plus a merge rule) — it does
          not get one from this table.
        </LI>
        <LI>
          Within one file, the relay publishes in <Code>seq</Code> order,
          one row at a time. A later row is not published while an earlier
          due row is still failing and retrying in the same batch scan — but
          a failed row with a future <Code>next_attempt_at</Code> does not
          block later rows in later scans. Order is best-effort across
          failures, strict within a single successful scan.
        </LI>
      </UL>

      <H2>Lifecycle and publish rules</H2>

      <CodeBlock
        title="Row lifecycle"
        code={`pending -> published
pending -> dead      (attempts reached maxAttempts, default 5)
dead -> pending      (manual replay only, via republishDead())
published rows are never deleted by the relay.`}
      />

      <UL>
        <LI>
          The relay marks a row <Code>published</Code> only after its publish
          function resolves. A publish function that rejects leaves the row{" "}
          <Code>pending</Code> (or <Code>dead</Code> at the attempt limit)
          with <Code>attempts</Code> incremented and{" "}
          <Code>next_attempt_at</Code> pushed out by exponential backoff:{" "}
          <Code>base * 2 ^ (attempts - 1)</Code>, capped at{" "}
          <Code>retryMaxMs</Code> (defaults: base 1000ms, cap 60000ms).
        </LI>
        <LI>
          Delivery is at-least-once, never at-most-once. A crash after
          publish but before the mark leaves the row <Code>pending</Code>, so
          the next relay run publishes it again. Nothing in this design
          prevents that second delivery, and nothing may assume it cannot
          happen.
        </LI>
        <LI>
          Therefore every consumer must be idempotent. Two mechanisms, in
          order: job delivery uses the job queue&apos;s existing idempotency
          key — the relay enqueues with{" "}
          <Code>uniqueKey: &quot;outbox:&lt;event_id&gt;&quot;</Code>, so a
          second enqueue while the first job is still queued, delayed, or
          running returns the existing job instead of creating a duplicate.
          And job and event handlers themselves must tolerate a second
          delivery after the first job completed (the unique key only covers
          active jobs). Check <Code>event_id</Code> before any
          non-idempotent side effect, or make the side effect itself
          idempotent. The relay cannot do this for the consumer.
        </LI>
        <LI>
          The relay holds no state in memory. Restart pickup is free: a new
          relay on the same file reads the same <Code>pending</Code> rows on
          its first scan, including rows left by a crashed relay. The
          relay&apos;s interval loop also runs a scan immediately on{" "}
          <Code>start()</Code>.
        </LI>
        <LI>
          Run one relay per database file. Two relays on the same file do not
          lose events, but they can both publish the same row before either
          marks it, so duplicates rise. The dedupe rules above still hold;
          the cost is duplicate work, not lost or corrupted work.
        </LI>
        <LI>
          The event-bus adapter must treat listener failure as publish
          failure: it emits with <Code>throwOnError: true</Code>. The
          bus&apos;s default swallows listener errors, and a relay built on
          that default would mark rows published that no listener handled.
        </LI>
      </UL>

      <H2>What each consumer reads</H2>

      <P>
        All consumers read with{" "}
        <Code>readChangeLog(store, {"{"} afterSeq, limit, ... {"}"})</Code>,
        which returns rows in <Code>seq</Code> order, exclusive of{" "}
        <Code>afterSeq</Code>. A consumer keeps its own checkpoint (its last
        processed <Code>seq</Code>, stored wherever the consumer owns state)
        and resumes from it. The log never tracks consumers; adding a
        consumer never changes the table.
      </P>

      <Callout kind="warn">
        The read helpers live in <code>src/types/outbox.ts</code>, but the
        package does not yet export a <code>yatta.js/outbox</code> subpath —
        there is no <code>./outbox</code> entry in the package exports. Until
        that export lands, import them from the source file in the repo.
      </Callout>

      <CodeBlock
        title="One reader, one checkpoint"
        code={`import { readChangeLog } from "yatta.js/outbox";

let checkpoint = 0;
const rows = readChangeLog(db, { afterSeq: checkpoint, limit: 100 });
for (const row of rows) {
  apply(row);
  checkpoint = row.seq;
}`}
      />

      <UL>
        <LI>
          <strong>Outbox relay (today):</strong> reads{" "}
          <Code>pending</Code> rows due for retry, in <Code>seq</Code>{" "}
          order, via <Code>listPending()</Code>. It does not use{" "}
          <Code>afterSeq</Code>; its cursor is the row&apos;s{" "}
          <Code>status</Code>, and it marks rows itself.
        </LI>
        <LI>
          <strong>Replication (future):</strong> reads all rows with{" "}
          <Code>afterSeq</Code> equal to its checkpoint, regardless of{" "}
          <Code>status</Code>, and applies them to the replica in{" "}
          <Code>seq</Code> order. It must apply idempotently by{" "}
          <Code>event_id</Code>: a replica that restarts re-reads from its
          checkpoint and may see rows it already applied. It must not filter
          on <Code>status = &apos;published&apos;</Code>, because a row can
          be applied to a replica before the relay publishes it elsewhere,
          and filtering would stall replication behind relay failures.
          Replication and relay are independent readers of one log.
        </LI>
        <LI>
          <strong>Time-travel replay (future):</strong> reads by{" "}
          <Code>aggregate_type</Code> and <Code>aggregate_id</Code> with{" "}
          <Code>afterSeq</Code>, in <Code>seq</Code> order, and replays
          payloads to rebuild state at a chosen <Code>seq</Code>. It reads{" "}
          <Code>published</Code> and <Code>dead</Code> rows as well as{" "}
          <Code>pending</Code> ones: the log is history, not a queue, and a
          row&apos;s relay status says nothing about whether it happened.
          Replay must ignore <Code>status</Code> and must not mark rows.
        </LI>
        <LI>
          <strong>In-process event bus durability (future):</strong> the
          relay&apos;s event-bus adapter is the bridge. App code records the
          event in the outbox instead of emitting directly; the relay emits
          it after commit. Listeners still receive each event at least once
          and must be idempotent, exactly as for job delivery.
        </LI>
      </UL>

      <H2>Retention</H2>

      <P>
        Published rows are history, so the relay never deletes them. Purging
        is an explicit operator action via{" "}
        <Code>purgePublished(store, {"{"} beforeSeq {"}"})</Code> or{" "}
        <Code>purgePublished(store, {"{"} olderThanMs {"}"})</Code>, which
        deletes only <Code>published</Code> rows, never{" "}
        <Code>pending</Code> or <Code>dead</Code> ones. Purge only below the
        lowest checkpoint of every consumer that reads history (replication,
        replay); purging above a consumer&apos;s checkpoint silently rewrites
        that consumer&apos;s history. If no consumer reads history, purge by
        age freely.
      </P>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>Recording outside a transaction is still one atomic
          insert, but it is not atomic with anything else.</strong> The
          whole point is lost if the user write and{" "}
          <Code>recordOutbox()</Code> are two separate calls outside{" "}
          <Code>db.transaction()</Code>.
        </LI>
        <LI>
          <strong><Code>db.transaction()</Code> takes a synchronous
          function.</strong> Do the async work first, then run the
          transaction; an async callback commits before its awaits finish.
        </LI>
        <LI>
          <strong>Never put secrets, tokens, or passwords in{" "}
          <Code>payload</Code> or <Code>last_error</Code>.</strong> The log
          is retained as history and may be replicated.
        </LI>
        <LI>
          <strong>A duplicate <Code>event_id</Code> or{" "}
          <Code>dedupe_key</Code> is rejected at record time.</strong> That
          is the write-time dedupe working, not a bug: the caller is
          recording an event that already exists.
        </LI>
        <LI>
          <strong><Code>payload</Code> must survive{" "}
          <Code>JSON.stringify</Code>.</strong> Functions,{" "}
          <Code>undefined</Code>, symbols, and circular objects are rejected
          at record time, not at publish time, so a bad payload fails the
          user&apos;s transaction instead of poisoning the relay.
        </LI>
      </UL>

      <Note>
        Durability scope: a committed transaction survives a process crash,
        and the transaction rules the outbox relies on hold — the wrapped
        function must be synchronous, the driver commits when it returns,
        rolls back when it throws, and nested transactions become savepoints.
        One limit carries over from the existing database layer: it runs WAL
        with <Code>PRAGMA synchronous = NORMAL</Code>, and under NORMAL a
        power loss can lose the last commits (without corrupting the
        database). So &ldquo;committed&rdquo; here means durable across a
        process crash, not proven against power loss. If a deployment needs
        power-loss durability, that is a change to the database
        layer&apos;s synchronous setting, not to the outbox.
      </Note>

      <DocFooter
        prev={{ href: "/docs/outbox", title: "Transactional outbox" }}
        next={{ href: "/docs/full-text-search", title: "Full-text search" }}
      />
    </article>
  );
}
