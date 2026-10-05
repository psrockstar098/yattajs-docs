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
  title: "Audit log — YATTA Examples",
  description:
    "An append-only audit trail with hash chaining, so tampering is detectable rather than merely discouraged.",
};

export default function AuditLogExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Audit log" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Append-only, hash-chained, and verifiable. A row that has been altered no longer links to its successor.">
        Audit log
      </H1>

      <H2 id="why-chain">Why hash chaining</H2>

      <P>An append-only table is a promise. Hash chaining turns it into a verifiable fact: each row commits to the previous one, so deleting or editing a row breaks every link after it.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta.js/db";

export const schema = {
  auditLog: {
    id: col.uuid(),
    // Monotonic per tenant — an out-of-order insert is visible, not silent.
    seq: col.integer(),
    tenantId: col.text().nullable(),
    actorId: col.text().nullable(),
    action: col.text(),
    target: col.text(),
    before: col.json<Record<string, unknown>>().nullable(),
    after: col.json<Record<string, unknown>>().nullable(),
    /** sha256(prevHash + canonical payload). */
    hash: col.text(),
    prevHash: col.text(),
    at: col.createdAt(),
  },
};

export const db = createDatabase({ url: process.env.DATABASE_URL, schema });`}
      />

      <H2 id="chain">Append a chained entry</H2>

      <CodeBlock
        title="yatta/func/audit.ts"
        code={`import { createHash } from "node:crypto";

const GENESIS = "0".repeat(64);

export interface AuditEntry {
  seq: number;
  tenantId: string | null;
  actorId: string | null;
  action: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  hash: string;
  prevHash: string;
  at: string;
}

/**
 * Stable serialisation.
 *
 * JSON.stringify key order follows insertion order, so two structurally equal
 * objects can serialise differently and break the chain. Sorting the keys is
 * what makes the hash reproducible.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return \`[\${value.map(canonical).join(",")}]\`;

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => \`\${JSON.stringify(k)}:\${canonical(v)}\`);

  return \`{\${entries.join(",")}}\`;
}

export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  return createHash("sha256").update(entry.prevHash + canonical(entry)).digest("hex");
}

export async function record(
  input: Omit<AuditEntry, "seq" | "hash" | "prevHash" | "at">,
): Promise<AuditEntry> {
  const previous = await db.auditLog
    .where((f) => (input.tenantId ? f.tenantId.isEqualTo(input.tenantId) : f.tenantId.isNull()))
    .orderBy({ seq: "desc" })
    .first();

  const partial: Omit<AuditEntry, "hash"> = {
    ...input,
    seq: (previous?.seq ?? 0) + 1,
    prevHash: previous?.hash ?? GENESIS,
    at: new Date().toISOString(),
  };

  const entry: AuditEntry = { ...partial, hash: hashEntry(partial) };
  await db.auditLog.insert(entry);

  return entry;
}`}
      />

      <Callout kind="warn">Never <code>update</code> or <code>delete</code> a row in this table. Not to redact a mistake, not for GDPR. Redact by writing a compensating entry &mdash; that is the only honest way to correct an append-only log.</Callout>

      <H2 id="verify">Verify the chain</H2>

      <P>A verifier is worthless if you never run it. Sweep it on a schedule and record the result.</P>

      <CodeBlock
        title="yatta/func/audit-verify.ts"
        code={`import { hashEntry } from "./audit";

export interface ChainReport {
  tenantId: string | null;
  entries: number;
  valid: boolean;
  /** Index of the first row whose hash does not match. */
  brokenAt: number | null;
}

export async function verifyChain(tenantId: string | null): Promise<ChainReport> {
  const rows = await db.auditLog
    .where((f) => (tenantId ? f.tenantId.isEqualTo(tenantId) : f.tenantId.isNull()))
    .orderBy({ seq: "asc" })
    .all();

  let expectedPrev = "0".repeat(64);
  let previousSeq = 0;

  for (const row of rows) {
    const { hash, ...rest } = row;

    // A gap in the sequence is as much a tamper signal as a bad hash.
    if (row.seq !== previousSeq + 1 || row.prevHash !== expectedPrev) {
      return { tenantId, entries: rows.length, valid: false, brokenAt: row.seq };
    }

    if (hashEntry(rest as Omit<AuditEntry, "hash">) !== hash) {
      return { tenantId, entries: rows.length, valid: false, brokenAt: row.seq };
    }

    expectedPrev = hash;
    previousSeq = row.seq;
  }

  return { tenantId, entries: rows.length, valid: true, brokenAt: null };
}`}
      />

      <H2 id="diff">Diffing a record</H2>

      <CodeBlock
        title="yatta/func/audit.ts"
        code={`/** Minimal field-level diff, so a viewer shows what actually changed. */
export function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; from: unknown; to: unknown }> {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field: key, from, to });
    }
  }

  return changes;
}`}
      />

      <Callout kind="tip">Record the diff, not the whole row. Storing before and after in full duplicates every secret that ever passed through the object.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/webhook-relay", title: "Webhook relay" }}
        next={{ href: "/docs/examples/feature-flags", title: "Feature flags" }}
      />
    </article>
  );
}
