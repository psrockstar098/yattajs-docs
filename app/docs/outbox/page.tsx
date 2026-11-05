import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Transactional outbox — YATTA Docs",
  description:
    "Record an event in the same transaction as the change it describes, then let a relay publish it to the job queue or the event bus — durably, at least once.",
};

export default function OutboxDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Transactional outbox" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Your app writes to one database file, then pipes an event into another — a crash between the two drops the event silently. The outbox records the event in the same file, in the same transaction, as the change it describes.">
        Transactional outbox
      </H1>

      <P>
        A relay then publishes the recorded event to the job queue or the
        event bus, and marks it done only after the publish succeeds.
      </P>

      <H2>Recording an event</H2>

      <CodeBlock
        title="Same transaction, same file"
        code={`import { createDatabase, col } from "yatta.js/db";

const db = createDatabase({ path: "Database/app.db", schema });

db.transaction((tx) => {
  const user = tx.users.insert({ email: "ada@example.com", name: "Ada" });
  tx.recordOutbox({
    eventType: "user.registered",
    aggregateType: "user",
    aggregateId: user.id,
    payload: { userId: user.id, email: user.email },
  });
});`}
      />

      <P>
        If the transaction rolls back, the user row and the outbox entry
        both disappear. If it commits, both are durable. There is no window
        where one exists without the other. Recording is a method on the
        database object (and on the transaction proxy), so it needs no
        separate import.
      </P>

      <Props
        items={[
          { name: "eventType", desc: "What happened, e.g. \"user.registered\". Required. Consumers filter on this." },
          { name: "payload", desc: "The event data. Must be JSON-serializable; functions, undefined, symbols, and circular objects are rejected at record time. Required." },
          { name: "eventId", desc: "Stable identity of this event. Defaults to a fresh UUID. Pass one to make recording itself idempotent — a duplicate event_id is rejected at record time." },
          { name: "aggregateType", desc: "What kind of thing changed, e.g. \"user\". Null when the event has no aggregate." },
          { name: "aggregateId", desc: "Which thing changed. Together with aggregateType it selects one aggregate's history." },
          { name: "dedupeKey", desc: "Caller-chosen dedupe key, e.g. \"welcome-email:<userId>\". Unique when present; nulls do not collide." },
          { name: "occurredAt", desc: "Business time of the event, in milliseconds since epoch. Defaults to record time; pass an earlier business time when the event happened before it was recorded." },
        ]}
      />

      <H2>Opt-in and lazy — zero cost when unconfigured</H2>

      <P>
        The outbox is fully opt-in. Plain writes do nothing extra: no outbox
        table is created, no log row is written, and the outbox module is not
        even loaded until the first <Code>recordOutbox()</Code> call. Nothing
        starts a relay unless the app constructs one. Everything runs on
        SQLite itself through Bun&apos;s own <Code>bun:sqlite</Code>{" "}
        primitives; there is no sidecar process and no new native dependency.
      </P>

      <H2>Relay — publish, then mark done</H2>

      <Callout kind="warn">
        The relay helpers live in <code>src/types/outbox.ts</code>, but the
        package does not yet export a <code>yatta.js/outbox</code> subpath —
        there is no <code>./outbox</code> entry in the package exports. Until
        that export lands, import them from the source file in the repo.
        Recording, above, needs no import at all: it is a method on the
        database object.
      </Callout>

      <CodeBlock
        title="Publish to the job queue"
        code={`import { createOutboxRelay, toJobPublish } from "yatta.js/outbox";
import { createJobs } from "yatta.js/jobs";

const jobs = createJobs();

const relay = createOutboxRelay(db, toJobPublish(jobs, "send-email"));
relay.start();`}
      />

      <P>
        The relay scans pending rows in order, publishes each one, and marks
        it published only after the publish resolves. A failure leaves the
        row pending for retry with exponential backoff; after 5 attempts it
        goes to the dead list instead of retrying forever. Restart pickup is
        free: the relay keeps no state in memory, so a fresh relay on the
        same file picks up whatever the last one left behind. The interval
        loop also runs a scan immediately on <Code>start()</Code>.
      </P>

      <Props
        items={[
          { name: "pollIntervalMs", desc: "Milliseconds between scans. Default 1000." },
          { name: "batchSize", desc: "Rows per scan. Default 100." },
          { name: "maxAttempts", desc: "Attempts before a row goes dead. Default 5." },
          { name: "retryBaseMs", desc: "First retry delay in milliseconds. Default 1000." },
          { name: "retryMaxMs", desc: "Retry delay cap in milliseconds. Default 60000. Backoff is base * 2 ^ (attempts - 1), capped." },
          { name: "publishTimeoutMs", desc: "Maximum time a single publish may take, in milliseconds. Unset by default — a publish function with no timeout of its own can stall a scan. A timeout counts as a publish failure." },
        ]}
      />

      <P>
        Delivery is at-least-once. A crash after publish but before the mark
        publishes the entry again, so handlers must tolerate a second
        delivery. Job delivery helps: each job is enqueued with a key
        derived from the event (<Code>uniqueKey: &quot;outbox:&lt;event_id&gt;&quot;</Code>),
        so a redelivery while the first job is still active returns the
        existing job instead of a duplicate. After the first job completes,
        the handler itself must still check the event before any side effect
        that cannot run twice.
      </P>

      <CodeBlock
        title="Publish to the event bus instead"
        code={`import { createOutboxRelay, toEventPublish } from "yatta.js/outbox";
import { createEvents } from "yatta.js/jobs";

const events = createEvents();

// Emits the event after commit, instead of emitting directly.
const relay = createOutboxRelay(db, toEventPublish(events));
relay.start();`}
      />

      <P>
        The event-bus adapter emits with <Code>throwOnError: true</Code>, so
        a listener failure counts as a publish failure. The bus&apos;s
        default swallows listener errors, and a relay built on that default
        would mark rows published that no listener handled.
      </P>

      <H2>Reading the log</H2>

      <P>
        The outbox table is also the shared change log: one log that later
        features can use for replication and replay. Read it by checkpoint,
        in order, and keep the checkpoint wherever the reader owns state.
      </P>

      <CodeBlock
        title="Read by checkpoint"
        code={`import { readChangeLog } from "yatta.js/outbox";

const rows = readChangeLog(db, { afterSeq: lastSeenSeq, limit: 100 });
const userHistory = readChangeLog(db, { aggregateType: "user", aggregateId: userId });`}
      />

      <P>
        Published rows are kept as history. Purge them only below every
        reader&apos;s checkpoint, with{" "}
        <Code>purgePublished(db, {"{"} beforeSeq {"}"})</Code> or{" "}
        <Code>purgePublished(db, {"{"} olderThanMs {"}"})</Code>, and never
        expect a sequence number to be reused: rolled-back writes leave
        gaps, and gaps mean &ldquo;nothing was ever published there&rdquo;.
        A dead row can be sent back for another try with{" "}
        <Code>republishDead(db, eventId)</Code>, which returns{" "}
        <Code>true</Code> when a dead row was revived.{" "}
        <Code>outboxCounts(db)</Code> returns the pending, published, and
        dead counts, for relay health checks.
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
          <strong>One relay per database file.</strong> Two relays on the
          same file do not lose events, but they can both publish the same
          row before either marks it, so duplicates rise.
        </LI>
        <LI>
          <strong>A publish function with no timeout of its own can stall a
          scan.</strong> Pass <Code>publishTimeoutMs</Code> when the publish
          target has no timeout.
        </LI>
        <LI>
          <strong>Never put secrets in a payload.</strong> The log is
          retained as history.
        </LI>
        <LI>
          <strong>A duplicate event id or dedupe key is rejected at record
          time.</strong> That is the write-time dedupe working, not a bug.
        </LI>
      </UL>

      <Note>
        Durability scope: a committed transaction survives a process crash.
        The database layer runs WAL with{" "}
        <Code>PRAGMA synchronous = NORMAL</Code>, and under NORMAL a power
        loss can lose the last commits (without corrupting the database). So
        &ldquo;committed&rdquo; here means durable across a process crash,
        not proven against power loss.
      </Note>

      <DocFooter
        prev={{ href: "/docs/migrate-generate", title: "Auto-migrations" }}
        next={{ href: "/docs/shared-change-log", title: "Shared change log" }}
      />
    </article>
  );
}
