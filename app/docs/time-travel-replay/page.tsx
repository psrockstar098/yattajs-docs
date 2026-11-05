import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Time-travel replay — YATTA Docs",
  description:
    "Rebuild an aggregate's state as of any point in its history, from the shared change log. Dev only, fail-closed, and it never writes your tables.",
};

export default function TimeTravelReplayDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Time-travel replay" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Rebuild an aggregate's state as of any point in its history, from the shared change log — no second log, and never against production.">
        Time-travel replay
      </H1>

      <P>
        Replay reads the same <Code>_yatta_outbox</Code> table the outbox
        relay publishes from, in <Code>seq</Code> order, and ignores each
        row&apos;s relay status: the log is history, not a queue.
      </P>

      <H2>Dev-only enforcement, in code</H2>

      <P>
        Replay is never on by default, and it never runs against production:
      </P>

      <UL>
        <LI>
          Every entry point requires <Code>{"{ enabled: true }"}</Code>.
          Without it, the call throws.
        </LI>
        <LI>
          Every entry point refuses when the environment is production. The
          check looks at the explicit <Code>environment</Code> option,{" "}
          <Code>YATTA_ENV</Code>, and <Code>NODE_ENV</Code> — a production
          signal from any of them refuses the call, so an option cannot hide a
          production <Code>NODE_ENV</Code>.
        </LI>
        <LI>
          The gate fails closed on an unknown environment too: with no
          environment signal anywhere, the call throws instead of assuming
          &ldquo;not production&rdquo;.
        </LI>
      </UL>

      <Callout kind="warn">
        Rewind never writes to the application&apos;s own tables. It returns
        rebuilt state in memory; in dev, the caller writes that state back
        explicitly if that is what they want. There is no code path in this
        feature that rewinds a production database, and no flag that enables
        one.
      </Callout>

      <H2>Rebuild state from the log</H2>

      <CodeBlock
        title="Replay one aggregate"
        code={`import { createReplayRunner } from "yatta.js/replay";

const replay = createReplayRunner(db, {
  enabled: true,
  environment: "development",
});

const result = replay.replay({
  aggregateType: "user",
  aggregateId: user.id,
  // Pure fold: returns the next state, performs no external effect.
  reducer: (state, entry) => {
    if (entry.eventType === "user.renamed") {
      return { ...state, name: entry.payload.name };
    }
    return state;
  },
  initialState: { name: null },
});
// result.state is the aggregate now; result.lastSeq is the last seq folded.`}
      />

      <P>
        Replay up to a position with <Code>upToSeq</Code>, or from a position
        with <Code>fromSeq</Code>. Both bounds are on <Code>seq</Code>, the
        log&apos;s only ordering key.
      </P>

      <H3>What replay returns</H3>

      <Props
        items={[
          { name: "state", desc: "The rebuilt aggregate state." },
          { name: "lastSeq", desc: "Last log seq folded, or the starting seq when nothing was folded." },
          { name: "appliedCount", desc: "Entries folded into state." },
          { name: "skippedCount", desc: "Entries skipped because isApplied already knew them." },
          { name: "eventIds", desc: "Event ids folded, in seq order." },
        ]}
      />

      <H2>Snapshots: rewind to a checkpoint</H2>

      <P>
        A snapshot stores one aggregate&apos;s state as of one{" "}
        <Code>seq</Code>, checksummed with SHA-256, in{" "}
        <Code>_yatta_replay_snapshots</Code> (a snapshot table, not a second
        event log — the log itself is still only{" "}
        <Code>_yatta_outbox</Code>).
      </P>

      <CodeBlock
        title="Snapshot, then rewind"
        code={`const snapshot = replay.snapshot({
  aggregateType: "user",
  aggregateId: user.id,
  reducer,
  initialState: { name: null },
  upToSeq: 42,
});

// Later: state as of seq 42, then only the entries after it replayed.
const rewound = replay.rewind({
  aggregateType: "user",
  aggregateId: user.id,
  reducer,
  initialState: { name: null },
  targetSeq: 60,
});
// rewound.snapshotUsed is the snapshot replay started from, or null.`}
      />

      <P>
        A snapshot whose stored state no longer matches its checksum throws on
        load — a corrupt snapshot fails loudly and never replays wrong state.
        A corrupt log payload throws the same way: replay refuses to guess.{" "}
        <Code>seq</Code> must strictly increase and <Code>event_id</Code> must
        be unique within a replay; violations throw instead of producing
        state.
      </P>

      <H2>Side effects: replay must not double-apply</H2>

      <P>
        The shared log delivers at-least-once, so an entry may already have
        been acted on. The reducer must be pure — never send an email, run a
        job, or charge a payment from inside it. When the caller does need to
        track what was already applied, pass their own applied set:
      </P>

      <CodeBlock
        title="Caller-owned applied set"
        code={`const applied = new Set<string>();
replay.replay({
  aggregateType: "user",
  aggregateId: user.id,
  reducer,
  initialState,
  isApplied: (eventId) => applied.has(eventId),
  markApplied: (eventId) => applied.add(eventId),
});`}
      />

      <P>
        Entries <Code>isApplied</Code> already knows are skipped and counted
        in <Code>skippedCount</Code>, never folded twice.
      </P>

      <H2>Laziness</H2>

      <P>
        This module is not imported by the framework entry points, so loading
        the framework costs nothing here. It is reachable only through its own
        export path, <Code>yatta.js/replay</Code>, which a caller imports
        deliberately. No snapshot table is created and no log is read until a
        caller builds a runner with the dev flag set.
      </P>

      <Note>
        The pure helper <Code>replayEntries()</Code> folds entries already in
        memory and touches no store, so it carries no dev gate. The gate lives
        on every function that reads a database or stores a snapshot.
      </Note>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          Replay reads one database file&apos;s log. There is no total order
          across files; an aggregate that spans files has no single replay.
        </LI>
        <LI>
          Purging published rows below a snapshot&apos;s <Code>seq</Code>{" "}
          rewrites the history that snapshot stands on. Do not purge below the
          lowest snapshot or replay position you still need, same rule as the
          shared log&apos;s retention note.
        </LI>
        <LI>
          A tampered log row that keeps a valid <Code>seq</Code>, a unique{" "}
          <Code>event_id</Code>, and valid JSON payload cannot be detected by
          replay alone — the shared log has no per-row checksum column, and
          adding one would change the shared contract. Snapshots bound the
          damage: tampering after the latest verified snapshot still replays,
          but tampering with a snapshot itself is caught by its checksum.
        </LI>
        <LI>
          Snapshot state must be JSON-serializable, same rule as log payloads.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/message-bus", title: "Message bus" }}
        next={{ href: "/docs/replication", title: "Replication" }}
      />
    </article>
  );
}
