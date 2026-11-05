import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Message bus — YATTA Docs",
  description:
    "Share events between cluster workers through a hub, and deliver events durably from the shared change log — without replacing the local bus.",
};

export default function MessageBusDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Message bus" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="The bus you already have, shared between processes: live fan-out between cluster workers, and durable delivery from the change log when a worker was down.">
        Message bus
      </H1>

      <P>
        The bus itself already exists: <Code>createEvents</Code> in{" "}
        <Code>yatta.js/jobs</Code> gives you <Code>on</Code> /{" "}
        <Code>once</Code> / <Code>emit</Code> / <Code>waitFor</Code> /{" "}
        <Code>pipe</Code>, with exact, prefix, suffix, and global wildcard
        matching. This page covers only the two gaps: sharing events between{" "}
        <Code>yatta cluster</Code> workers, and delivering events durably.
        Nothing here replaces the bus, and nothing here runs unless you opt
        into it — a bus with no attachment behaves exactly as before, local
        only.
      </P>

      <CodeBlock
        title="Import"
        code={`import {
  attachClusterTransport,
  createClusterHub,
  createWebSocketClusterTransport,
  createDurableConsumer,
  publishDurable,
} from "yatta.js/bus-cluster";`}
      />

      <P>
        Import from the lazy entry point. It is not imported by the bus, the
        CLI, or the server entry point, so importing the rest of the
        framework never pulls it in.
      </P>

      <H2>Cluster delivery: live fan-out between workers</H2>

      <P>
        Cluster workers are separate processes with no channel between them,
        so they share events through one hub process. Run the hub once, then
        connect every worker to it.
      </P>

      <CodeBlock
        title="Hub process — run once"
        code={`// Binds localhost by default. Needs a token unless you explicitly
// allow unauthenticated peers for local development.
const hub = createClusterHub({ token: process.env.CLUSTER_BUS_TOKEN });
console.log("hub at", hub.url);`}
      />

      <CodeBlock
        title="In each worker"
        code={`import { createEvents } from "yatta.js/jobs";

const events = createEvents();
const transport = createWebSocketClusterTransport(hubUrl, {
  token: process.env.CLUSTER_BUS_TOKEN,
});
await transport.connect();
const cluster = attachClusterTransport(events, transport);

// Emits locally AND to every other worker:
await cluster.publish("user.registered", { userId: "u1" });

// Listeners registered the usual way fire for local and remote
// events alike. No listener changes needed:
events.on("user.registered", (user) => {
  console.log("welcome", user.userId);
});`}
      />

      <H3>Rules of the road</H3>

      <UL>
        <LI>
          <Code>publish</Code> is the only path that forwards. An event
          arriving from the hub is emitted locally and stops there, so it can
          never bounce between workers. A worker hears its own publish once,
          from its local emit, not from the hub echo.
        </LI>
        <LI>
          Delivery is live fan-out only. A worker that is down when an event
          is published misses it — there is no replay on the hub. When a
          missed event must be caught up after a restart, record it durably
          (below) and replay from the change log.
        </LI>
        <LI>
          <Code>publish</Code> sends only JSON-faithful payloads. Functions,{" "}
          <Code>undefined</Code>, symbols, bigints, non-finite numbers, and
          circular values are rejected, because plain{" "}
          <Code>JSON.stringify</Code> would silently change them in transit
          (dropping function properties, turning <Code>NaN</Code> into{" "}
          <Code>null</Code>). Event names must be plain dotted names: no
          wildcards, no empty segments.
        </LI>
        <LI>
          Sending while disconnected throws instead of silently dropping the
          event, so the caller can fall back to durable recording. Unexpected
          closes reconnect with capped backoff; set{" "}
          <Code>maxReconnectAttempts</Code> when a peer with a wrong token
          should stop retrying and surface as disconnected.
        </LI>
        <LI>
          Payloads are untrusted network input. The bridge validates the
          envelope shape and never runs code carried in a payload, but a
          listener must still validate any field it acts on, the same as for
          any network input.
        </LI>
      </UL>

      <H3>Transport options</H3>

      <Props
        items={[
          { name: "token", type: "string", desc: "Shared secret. Defaults to CLUSTER_BUS_TOKEN." },
          { name: "reconnect", type: "boolean · true", desc: "Reconnect after an unexpected close." },
          { name: "reconnectBaseMs", type: "number · 100", desc: "First reconnect delay in milliseconds." },
          { name: "reconnectMaxMs", type: "number · 5000", desc: "Reconnect delay cap in milliseconds." },
          { name: "maxReconnectAttempts", type: "number", desc: "Maximum reconnect attempts. Unset by default: retry forever with capped backoff." },
          { name: "onStatus", type: "(status) => void", desc: "Called with \"connected\", \"disconnected\", or \"reconnecting\"." },
        ]}
      />

      <H2>Durable delivery: the shared change log</H2>

      <P>
        Durable delivery is built on the shared change log: the same{" "}
        <Code>_yatta_outbox</Code> table in the same database file, the same{" "}
        <Code>recordOutbox</Code> / <Code>readChangeLog</Code> contract. No
        new table is created here.
      </P>

      <P>
        Record inside the transaction, alongside the write the event is
        about, so both commit or roll back together:
      </P>

      <CodeBlock
        title="Record durably"
        code={`import { publishDurable } from "yatta.js/bus-cluster";

db.transaction((tx) => {
  const user = tx.users.insert({ email: "ada@example.com", name: "Ada" });
  publishDurable(tx, "user.registered", { userId: user.id, email: user.email });
});`}
      />

      <P>
        Recording alone emits nothing — that is what makes it safe to record
        before commit. Delivery comes from a consumer (or a relay) reading
        the log:
      </P>

      <CodeBlock
        title="Replay the log into the bus"
        code={`// Replay the log into the bus, in seq order, one row at a time.
const consumer = createDurableConsumer(events, db, {
  checkpoint: createFileCheckpoint("Database/bus-checkpoint.txt"),
});
await consumer.start();`}
      />

      <P>
        A durable event arrives on the bus under its event type, carrying the
        change-log envelope:
      </P>

      <CodeBlock
        title="Durable event shape"
        code={`events.on("user.registered", (event) => {
  // event.outboxEventId, event.eventType, event.payload,
  // event.aggregateType, event.aggregateId, event.occurredAt
  console.log(event.payload);
});`}
      />

      <P>
        The relay form, for processes that already run an outbox relay, is the
        existing <Code>OutboxRelay</Code> with a bus adapter — rows are marked
        published only after the bus emit resolves, and a listener failure
        leaves the row pending for retry:
      </P>

      <CodeBlock
        title="Relay form"
        code={`import { createDurableRelay } from "yatta.js/bus-cluster";

const relay = createDurableRelay(db, events);
relay.start();`}
      />

      <H3>Consumer options</H3>

      <Props
        items={[
          { name: "fromSeq", type: "number", desc: "Seq to resume from. Defaults to the checkpoint, else 0 (from the start)." },
          { name: "checkpoint", type: "DurableCheckpoint", desc: "Where the last delivered seq is kept. Defaults to in-memory only. createFileCheckpoint writes it atomically (temp file + rename)." },
          { name: "seen", type: "SeenEventIds", desc: "Shared dedupe window. Defaults to a fresh one per consumer." },
          { name: "batchSize", type: "number · 100", desc: "Rows per read." },
          { name: "pollIntervalMs", type: "number · 1000", desc: "Milliseconds between polls." },
          { name: "eventType", type: "string", desc: "Only deliver this event type. Defaults to all types." },
          { name: "onError", type: "(error, entry) => void", desc: "Called when a listener fails or a checkpoint save fails. The row is retried." },
        ]}
      />

      <H2>Delivery guarantees, stated plainly</H2>

      <UL>
        <LI>
          Cluster delivery is at-most-once per live peer: a peer that is down
          misses the event, a peer that is up gets it once (duplicate
          envelopes arriving together are deduped by event id).
        </LI>
        <LI>
          Durable delivery is at-least-once. A crash between emit and
          checkpoint save, or a relay redelivery, can deliver one event twice.
          Handlers must stay idempotent by <Code>outboxEventId</Code> — check
          it before any non-idempotent side effect. The consumer&apos;s dedupe
          window only removes the common in-process duplicates (relay
          rescans, overlapping polls); it does not make delivery exactly-once,
          and no window could after a crash.
        </LI>
        <LI>
          The consumer&apos;s checkpoint advances only after a successful
          emit. A listener failure stops the pass at that row: the event is
          retried on the next pass, never skipped, and order is preserved.
        </LI>
        <LI>
          Cluster <Code>publish</Code> is not atomic across local and remote:
          local listeners fire before the forward happens, so a failed
          forward still leaves local side effects done. If you need atomicity,
          record durably first and let the relay or consumer deliver.
        </LI>
      </UL>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          Run one durable reader per log per process: either a relay or a
          consumer, not two independent ones expecting exactly-once. If both
          must read the same log, share one <Code>SeenEventIds</Code> between
          them so the second path skips rows the first already delivered.
        </LI>
        <LI>
          Do not share a checkpoint between a filtered consumer (
          <Code>eventType</Code> set) and an unfiltered one: the filtered
          consumer&apos;s checkpoint jumps past rows of other types, and an
          unfiltered consumer resuming from it would never see them.
        </LI>
        <LI>
          The hub&apos;s token is the trust boundary: anyone holding it can
          inject events into every worker. Keep the hub on localhost or
          behind TLS, never log the token, and rotate it if it leaks. The hub
          has no per-peer rate limiting, so a compromised token holder can
          flood workers — that is a reason to guard the token, not a reason to
          trust the payloads.
        </LI>
        <LI>
          <Code>publishDurable</Code> rejects the same event id or dedupe key
          twice at record time. That is the write-time dedupe working: pass a
          fresh id per event, or reuse an id deliberately to make recording
          itself idempotent.
        </LI>
        <LI>
          The durable consumer reads rows regardless of relay status — the log
          is history, and a row that happened counts even before any relay
          marks it published. That includes dead rows: a row the relay gave up
          on still replays through a consumer.
        </LI>
        <LI>
          Cluster mode today is one process per core with no shared memory.
          The hub is a separate process you run and supervise alongside them;
          if the hub dies, workers keep serving locally and their transports
          reconnect with backoff when it returns.
        </LI>
      </UL>

      <Callout>
        <Code>publish</Code> is not atomic across local and remote, and the
        hub keeps no state besides its live sockets: it is fan-out, not
        storage. If an event must survive a worker being down, record it
        durably — the hub will not replay it later.
      </Callout>

      <DocFooter
        prev={{ href: "/docs/profiler", title: "Profiler" }}
        next={{ href: "/docs/time-travel-replay", title: "Time-travel replay" }}
      />
    </article>
  );
}
