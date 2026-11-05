import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Callout, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Replication — YATTA Docs",
  description:
    "Phase 1 replication: one primary takes all writes, replicas pull the shared change log and serve reads. No leader election, no promotion.",
};

export default function ReplicationDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Replication" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Phase 1 only. One primary takes all writes. Replicas pull the shared change log and serve reads — and a replica never promotes itself.">
        Replication
      </H1>

      <P>
        There is no leader election here: that is phase 2 (Raft), and a
        replica never promotes itself. A partitioned replica just stalls on
        its last checkpoint and keeps serving old reads.
      </P>

      <H2>The shape</H2>

      <P>
        The primary answers pull requests, one log per database file:{" "}
        <Code>app</Code>, <Code>jobs</Code>, and <Code>cache</Code>. Auth
        tables live inside <Code>app.db</Code>, so there is no separate auth
        file to replicate. The publisher is a pull model: it keeps no
        per-replica state, so a replica that lies about its cursor can only
        waste its own time, never corrupt the primary.
      </P>

      <CodeBlock
        title="Primary side"
        code={`import { createDatabase } from "yatta.js/db";
import {
  createReplicationPublisher,
  createReplicationHttpHandler,
  createNodeToken,
} from "yatta.js/replication";

const secret = process.env.YATTA_REPLICATION_SECRET!; // env only, never logged
const appDb = createDatabase({ path: "Database/app.db", schema });

// Primary side: serve pulls over HTTP.
const publisher = createReplicationPublisher({ app: appDb }, {
  nodeId: "primary-1",
  secret,
  allowedReplicaIds: ["replica-1"], // optional; empty means any valid token
});
Bun.serve({ fetch: createReplicationHttpHandler(publisher) });`}
      />

      <CodeBlock
        title="Replica side"
        code={`import {
  createReplicationApplier,
  ReplicationRunner,
  createHttpReplicationTransport,
  createNodeToken,
} from "yatta.js/replication";

const replicaDb = createDatabase({ path: "Database/app.db", schema });
const applier = createReplicationApplier(replicaDb, {
  secret,
  expectedNodeId: "primary-1",
  // Optional: build a read model from each entry as it lands.
  // The handler runs BEFORE the entry is stored, so a failing
  // handler is retried on the next pull. Handlers must be idempotent.
  onEntry: (entry) => { /* entry: OutboxEntry, in seq order */ },
});
const transport = createHttpReplicationTransport(
  "https://primary.example",
  createNodeToken(secret, "replica-1"),
);
const runner = new ReplicationRunner(transport, new Map([["app", applier]]));
runner.start();`}
      />

      <CodeBlock
        title="Reads from a replica"
        code={`// The replicated log, in seq order.
const rows = applier.replicatedEntries("app", "app");
const checkpoint = applier.checkpoint("app", "app");`}
      />

      <H2>What a replica actually gets</H2>

      <P>
        This is the honest limit of phase 1: the change log only holds events
        the app recorded with <Code>recordOutbox()</Code>. A replica gets the
        log, plus whatever its <Code>onEntry</Code> handler builds from it. An
        app that wants a row visible on a replica must record that row&apos;s
        change in the outbox. Replication does not copy raw database rows, and
        it does not ship WAL bytes. A replica starting with no checkpoint
        pulls the whole log from seq 0, so the log is the bootstrap.
      </P>

      <P>
        Reads on the primary are unchanged. Reads on a replica are async: a
        replica can lag the primary, and lag is just{" "}
        <Code>latestSeq - checkpoint</Code>, reported on every pull.
      </P>

      <H2>Config: minimal, but not zero</H2>

      <P>
        &ldquo;Zero-config&rdquo; is aspirational. Node discovery and auth
        still need these, and a node without them runs nothing:
      </P>

      <CodeBlock
        code={`YATTA_REPLICATION_ROLE=primary | replica   # unset: replication is off, zero cost
YATTA_REPLICATION_NODE_ID=primary-1     # optional; defaults to "<role>-1"
YATTA_REPLICATION_SECRET=...            # required when the role is set; env only
YATTA_REPLICATION_PRIMARY_URL=https://primary.example  # replicas only
YATTA_REPLICATION_ALLOWED_REPLICAS=replica-1,replica-2  # primary only, optional
YATTA_REPLICATION_POLL_MS=1000
YATTA_REPLICATION_BATCH_SIZE=100`}
      />

      <CodeBlock
        title="Config from the environment"
        code={`import { replicationConfigFromEnv } from "yatta.js/replication";

// Returns null when the role is unset: that is the normal case, and
// nothing replication-related starts. Throws when the role is set
// but the secret (or a replica's primary URL) is missing: a
// configured node without a secret fails closed, never open.
const config = replicationConfigFromEnv();`}
      />

      <P>
        No config file is read, so no JSON5 parsing is involved: env plus
        programmatic config only.
      </P>

      <H2>Safety rules</H2>

      <UL>
        <LI>
          <strong>Auth first.</strong> Node tokens and batch signatures are
          HMAC-SHA256 over the shared secret. A node without the secret gets a
          401 and no data. The primary checks the allowlist when one is set.
        </LI>
        <LI>
          <strong>Replica-supplied data is never trusted by the
          primary:</strong> a replica sends only its cursor and its token, and
          a bad cursor is a 400.
        </LI>
        <LI>
          <strong>Primary-supplied data is never trusted by the
          replica:</strong> every batch is signature-checked, then every entry
          is shape-checked (seq, event id, event type, timestamps, payload
          size cap) before anything is stored. A bad batch applies nothing.
        </LI>
        <LI>
          <strong>Order:</strong> entries must arrive in strictly increasing
          seq order within a batch, or the whole batch is rejected. Gaps are
          fine: the log contract says a gap means nothing was ever published
          there.
        </LI>
        <LI>
          <strong>Idempotency:</strong> delivery is at-least-once. An entry at
          or below the checkpoint, or with an already-applied event id, is
          skipped. The handler runs before the entry is stored, so a failing
          handler is retried on the next pull; handlers must still be
          idempotent, because a crash between handler and store redelivers.
        </LI>
        <LI>
          <strong>Writes go to the primary only.</strong>{" "}
          <Code>createReadOnlyStore()</Code> wraps a replica store so app
          reads pass and <Code>rawRun</Code> throws{" "}
          <Code>ReplicaWriteError</Code>. That guards the raw surface only;
          ORM-level write blocking on a replica is a phase 2 follow-up, not
          shipped.
        </LI>
        <LI>
          The publisher never marks rows published. Replication and the outbox
          relay are independent readers of the same log, and replication reads
          all rows regardless of relay status: filtering on{" "}
          <Code>published</Code> would stall replication behind relay
          failures.
        </LI>
      </UL>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          Never purge published rows above a replica&apos;s checkpoint. Purging
          rewrites that replica&apos;s history, and its next pull can never
          fill the hole. Purge only below the lowest checkpoint of every
          replica.
        </LI>
        <LI>
          A replica&apos;s checkpoint is per file: <Code>app</Code>,{" "}
          <Code>jobs</Code>, and <Code>cache</Code> advance independently, and
          a failure pulling one file never moves another file&apos;s checkpoint.
        </LI>
        <LI>
          The HTTP transport has no response body size cap: a compromised
          primary could send a very large batch body. Per-entry payload caps
          still apply once the body is parsed, so this is an availability
          concern, not a corruption path, but it is open in phase 1.
        </LI>
        <LI>
          A primary that assigns the same seq to two different event ids fails
          the replica&apos;s insert and stalls that file fail-stop: the
          checkpoint stays put and the bad batch is retried, not applied. That
          needs an operator, not an automatic fix.
        </LI>
        <LI>
          WAL durability carries over from the shared change log: committed
          means durable across a process crash, not proven against power loss,
          under <Code>PRAGMA synchronous = NORMAL</Code>.
        </LI>
        <LI>
          No promotion, no failover, no write forwarding. If the primary is
          down, replicas serve stale reads until it returns. That is phase 2.
        </LI>
      </UL>

      <Callout>
        The read-only guard covers the raw store surface only. App-level
        writes through a full database object on a replica are not blocked by
        this module — ORM-level write blocking is a documented phase 2
        follow-up, not shipped.
      </Callout>

      <DocFooter
        prev={{ href: "/docs/time-travel-replay", title: "Time-travel replay" }}
        next={{ href: "/docs/raft", title: "Raft consensus" }}
      />
    </article>
  );
}
