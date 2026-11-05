import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Raft consensus — YATTA Docs",
  description:
    "Phase 2: when the primary dies, replicas elect a new leader by majority vote, and the new leader's log becomes authoritative.",
};

export default function RaftDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Raft consensus" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Phase 1 had one fixed primary and replicas that never promoted themselves. This phase adds the missing piece: when the primary dies, the replicas elect a new leader by majority vote.">
        Raft consensus
      </H1>

      <P>
        The log under Raft is still the shared change log. Raft stores no
        second copy of entry payloads: a leader&apos;s entries live in its{" "}
        <Code>_yatta_outbox</Code>, a follower&apos;s in its{" "}
        <Code>_yatta_replicated_log</Code> (phase 1&apos;s table), and Raft
        adds only two small tables in the same database file —{" "}
        <Code>_yatta_raft_state</Code> (current term, voted-for, commit index)
        and <Code>_yatta_raft_terms</Code> (the Raft term of each log position,
        which the change log itself does not record).
      </P>

      <P>
        The phase-1 rule still stands in the other direction: a replica NEVER
        self-promotes. It becomes leader ONLY by winning an election.
      </P>

      <H2>The shape</H2>

      <P>
        One Raft group, one log. Three nodes, <Code>a</Code>, <Code>b</Code>,{" "}
        <Code>c</Code>, wired with the in-memory transport (the HTTP transport
        below is the same shape over the wire):
      </P>

      <CodeBlock
        title="Three nodes, in-memory transport"
        code={`import { RaftNode, InMemoryRaftLog, InMemoryRaftTransport, PersistentRaftState } from "yatta.js/raft";

const secret = process.env.YATTA_RAFT_SECRET!; // env only, never logged

function makeNode(id: string, peers: string[], db: OutboxStore) {
  const node = new RaftNode({
    nodeId: id,
    peers,
    secret,
    log: new InMemoryRaftLog(),
    persistentState: new PersistentRaftState(db),
    timers: true, // election + heartbeat timers run after start()
  });
  const transport = new InMemoryRaftTransport(id, secret);
  // Every node must be registered on every peer's transport,
  // or RPCs to it are unreachable.
  transport.addNode(node);
  node.setTransport(transport);
  return { node, transport };
}`}
      />

      <CodeBlock
        title="Election and leader append"
        code={`// Election: the first node whose election timeout fires asks every
// peer for its vote. A voter grants at most one vote per term, and
// only to a candidate whose log is at least as up-to-date as its own
// (higher last term, or equal term and longer log). Two of three
// votes is a majority, so the winner becomes leader for that term.
const { node } = makeNode("a", ["b", "c"], db);
node.start(); // timers only start here; nothing runs before start()

// Leader append: only a leader may call this. The entry still needs
// a majority ack (via syncPeer / sendHeartbeats) before it commits —
// appending alone never commits.
const entry = node.appendAsLeader({
  eventId: "evt-1",
  eventType: "user.registered",
  payload: { user: "ada" },
  occurredAt: Date.now(),
  createdAt: Date.now(),
});
await node.sendHeartbeats();
node.commitIndex; // 1, once a majority holds the entry`}
      />

      <H3>Node options</H3>

      <Props
        items={[
          { name: "nodeId", type: "string", desc: "This node's id. Must not contain a dot (node tokens use dot as separator)." },
          { name: "peers", type: "string[]", desc: "Ids of the other nodes in the group, not including this node." },
          { name: "secret", type: "string", desc: "Shared secret, from the environment only. Required, always." },
          { name: "log", type: "RaftLog", desc: "The log this node holds. InMemoryRaftLog for tests; ChangeLogRaftLog over the phase-1 replicated log for real nodes." },
          { name: "persistentState", type: "PersistentRaftState", desc: "Durable term/vote/commit store. When omitted, state is memory-only and the node refuses to vote — use PersistentRaftState for any real node." },
          { name: "transport", type: "RaftTransport", desc: "Transport for outgoing RPCs. Optional: without one the node answers RPCs but sends none." },
          { name: "electionTimeoutMinMs", type: "number · 150", desc: "Election timeout window lower bound." },
          { name: "electionTimeoutMaxMs", type: "number · 300", desc: "Election timeout window upper bound. Randomized in [min, max) so nodes do not all fire at once." },
          { name: "heartbeatIntervalMs", type: "number · 50", desc: "Heartbeat interval. Must stay below the election minimum." },
          { name: "singleNode", type: "boolean", desc: "Single-node dev/test mode. With peers: [] and singleNode: true, start() elects this node immediately." },
          { name: "timers", type: "boolean · true", desc: "When false, start() schedules nothing: tests drive timeouts manually." },
          { name: "batchSize", type: "number · 100", desc: "Entries per AppendEntries message." },
        ]}
      />

      <H2>HTTP transport</H2>

      <P>
        The signed transport follows the phase-1 pattern: Bearer node token
        plus an HMAC over the AppendEntries body with a Raft-only domain
        string, so a phase-1 batch signature can never replay as a Raft
        message.
      </P>

      <CodeBlock
        title="Signed HTTP transport"
        code={`import { createSignedHttpRaftTransport, createRaftHttpHandler, createNodeToken } from "yatta.js/raft";

const transport = createSignedHttpRaftTransport(
  "https://peer-b.example",
  createNodeToken(secret, "a"),
  secret,
);
Bun.serve({ fetch: createRaftHttpHandler(node, secret) });`}
      />

      <Note kind="warn">
        <Code>createHttpRaftTransport</Code> (unsigned) posts AppendEntries
        without a signature and is therefore rejected by the signed handler.
        It is kept only so the signed transport can reuse its vote path; new
        code should use <Code>createSignedHttpRaftTransport</Code>.
      </Note>

      <H2>Config: fail-closed, opt-in, lazy</H2>

      <P>
        Nothing Raft-related starts unless Raft is explicitly enabled, and a
        node without quorum configuration never claims leadership:
      </P>

      <CodeBlock
        code={`YATTA_RAFT_ENABLED=true                 # anything else: Raft is off, zero cost
YATTA_RAFT_NODE_ID=a
YATTA_RAFT_SECRET=...                   # required when enabled; env only
YATTA_RAFT_PEERS=b,c                    # the other nodes in the group
YATTA_RAFT_SINGLE_NODE=true             # one-node group only; explicit, never implied
YATTA_RAFT_ELECTION_MIN_MS=150
YATTA_RAFT_ELECTION_MAX_MS=300
YATTA_RAFT_HEARTBEAT_MS=50              # must stay below the election minimum`}
      />

      <CodeBlock
        title="Config from the environment"
        code={`import { raftConfigFromEnv } from "yatta.js/raft";

// Returns null when YATTA_RAFT_ENABLED is not exactly "true": the
// normal unconfigured case. Throws when enabled but the secret, the
// node id, or the quorum config is missing — a configured node
// without a secret or without peers (and without single-node mode)
// fails closed instead of running unauthenticated or leaderless.
const config = raftConfigFromEnv();`}
      />

      <P>
        No framework entry point imports this module: a test greps{" "}
        <Code>src/main.ts</Code>, <Code>src/types/index.ts</Code>, and{" "}
        <Code>core_runtime/index.ts</Code> and fails if any of them mentions
        it. Import it only where Raft is actually constructed.
      </P>

      <H2>Safety rules</H2>

      <UL>
        <LI>
          <strong>One vote per term, persisted before it is granted.</strong>{" "}
          A restarted node resumes its term and its vote from{" "}
          <Code>_yatta_raft_state</Code>; it cannot double-vote. A node with
          no durable state refuses to grant votes entirely rather than risk
          it.
        </LI>
        <LI>
          <strong>Up-to-date vote rule:</strong> a voter refuses a candidate
          whose log is behind its own. Together with majority quorum, that is
          what makes leader completeness hold: an elected leader holds every
          committed entry, because every committed entry sits on a majority,
          and any election majority overlaps that majority at a voter that
          refuses stale candidates.
        </LI>
        <LI>
          <strong>Election safety: one leader per term.</strong> A candidate
          or leader that sees a higher term steps down at once; a candidate
          that sees a legitimate leader for its own term steps down too.
        </LI>
        <LI>
          <strong>No split-brain writes:</strong> a leader that cannot reach a
          majority within one election timeout (itself plus peers that acked
          recently) steps down to follower. A partitioned old leader stops
          claiming leadership instead of serving writes nobody else sees.
        </LI>
        <LI>
          <strong>Log consistency:</strong> the leader&apos;s log is
          authoritative. A follower checks <Code>prevLogSeq</Code>/
          <Code>prevLogTerm</Code> before applying anything, backs the leader
          up to its last seq on mismatch, and truncates a conflicting suffix
          only above its commit index. A conflict at or below the commit index
          is refused outright, and a refused message mutates nothing: the
          whole message is validated before any entry is applied or truncated.
        </LI>
        <LI>
          <strong>Commit rule:</strong> an entry commits when a majority holds
          it AND it is from the leader&apos;s current term. Entries from older
          terms commit only indirectly, when a current-term entry commits above
          them — the standard Raft rule that keeps a stale leader from
          committing by counting acks.
        </LI>
        <LI>
          <strong>Auth:</strong> Raft RPCs reuse phase-1 node tokens
          (HMAC-SHA256 over the shared secret). The HTTP handler verifies the
          token before parsing anything else, and verifies the AppendEntries
          signature over the raw wire body before applying anything. A node
          without the secret gets refused votes and refused AppendEntries, and
          learns nothing. Secrets and tokens are never logged.
        </LI>
      </UL>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          Single-node dev mode is explicit, not inferred.{" "}
          <Code>peers: []</Code> without <Code>singleNode: true</Code> throws
          at construction: a node with no quorum config must never claim
          leadership, and an empty peer list on its own is a misconfiguration,
          not a one-node cluster.
        </LI>
        <LI>
          A leader&apos;s originated entries go through{" "}
          <Code>appendOriginated()</Code> on the change-log adapter, which
          records the outbox row and then mirrors it into the Raft log view. A
          crash between the two leaves an outbox row with no Raft term, which
          votes as term 0 — safe direction only (less up-to-date, never more),
          and the next AppendEntries round re-mirrors it.
        </LI>
        <LI>
          Pre-Raft entries carry term 0. They vote as older than any Raft-era
          entry, which is correct: they predate every election. Two nodes
          holding only pre-Raft entries decide by log length.
        </LI>
        <LI>
          Election timeouts are randomized in <Code>[min, max)</Code> so nodes
          do not all fire at once after a leader dies; bounds are validated,
          and a heartbeat interval at or above the minimum is rejected. Timers
          are single chained timeouts, never intervals that can pile up: at
          most one election timer and one heartbeat timer exist per node, and{" "}
          <Code>stop()</Code> clears both.
        </LI>
        <LI>
          The HTTP handler&apos;s AppendEntries signature is verified over the
          raw wire body, not the validated subset: validation normalizes
          entries (dropping the full change-log fields the signer covered),
          and verifying over the subset would reject every legitimately signed
          message. The unsigned HTTP transport exists only for the vote path;
          AppendEntries over HTTP must use the signed transport, or the
          handler answers 401.
        </LI>
        <LI>
          A follower&apos;s commit index advances only from the leader&apos;s{" "}
          <Code>leaderCommit</Code>, capped at its own last seq. It never
          advances past entries it does not hold.
        </LI>
        <LI>
          WAL durability carries over from the shared change log: committed
          means durable across a process crash, not proven against power loss,
          under <Code>PRAGMA synchronous = NORMAL</Code>.
        </LI>
        <LI>
          ORM-level write blocking on replicas is still the open phase-1
          follow-up: <Code>createReadOnlyStore()</Code> guards the raw surface
          only, and Raft does not change that. A follower that is not the
          leader refuses <Code>appendAsLeader()</Code>, but app-level writes
          through a full database object are not blocked by this module.
        </LI>
      </UL>

      <H2>What Raft does NOT do</H2>

      <UL>
        <LI>
          <strong>No sharding.</strong> One group, one log. A deployment with
          several database files runs one Raft group per file if it wants them
          all covered; there is no merged cross-file order, exactly as in the
          shared change log.
        </LI>
        <LI>
          <strong>No multi-group membership changes.</strong> Peers are fixed
          at construction; adding or removing a node is a restart with new
          config, not a joint-consensus operation.
        </LI>
        <LI>
          <strong>No snapshots or log compaction.</strong> The log grows with
          the change log; purging follows the shared change log&apos;s rule
          (never above the lowest checkpoint of every consumer).
        </LI>
        <LI>
          <strong>No write forwarding.</strong> A follower that receives a
          write does not forward it to the leader; the caller must send writes
          to the leader, and <Code>appendAsLeader()</Code> on a non-leader
          throws.
        </LI>
        <LI>
          <strong>No leader leases beyond quorum loss.</strong> Leadership
          lasts until a higher term appears or quorum is lost; there is no
          wall-clock lease, and a leader that can still reach a majority keeps
          leading.
        </LI>
      </UL>

      <H2>Honest limits of this phase</H2>

      <Callout kind="warn">
        Real multi-process clusters are proven through the HTTP handler and the
        signed transport in tests, not against live peers on separate
        machines: the fake transport covers election and replication logic,
        the handler covers auth and validation, but no three-machine run
        happened on this VM.
      </Callout>

      <UL>
        <LI>
          A newly elected leader keeps using the same Raft log view it held as
          a follower (the phase-1 replicated log). Its future originated
          entries go through the outbox plus the mirror described above; seq
          continuity across that switch is the operator&apos;s to watch in a
          deployment where the old leader&apos;s outbox seqs and the
          follower&apos;s replicated seqs could diverge.
        </LI>
        <LI>
          The RequestVote <Code>candidateId</Code> comes from the request body
          and is not bound to token identity: the handler verifies the Bearer
          token, but never checks that the candidate named in the body is the
          node the token belongs to. One-vote-per-term is still enforced, so
          no split-brain commit is possible — but a token holder can cast a
          vote in another node&apos;s name.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/replication", title: "Replication" }}
        next={{ href: "/docs/protocols/webdav", title: "WebDAV" }}
      />
    </article>
  );
}
