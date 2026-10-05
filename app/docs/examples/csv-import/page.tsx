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
  title: "CSV import — YATTA Examples",
  description:
    "Streaming a large CSV into the database from a background job, with progress, batched writes and a dry run.",
};

export default function CsvImportExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "CSV import" },
        ]}
      />

      <H1 eyebrow="Examples" sub="A 400MB file that never enters memory, never blocks a request, and reports progress while it runs.">
        CSV import
      </H1>

      <H2 id="upload">Upload, do not parse</H2>

      <P>The request stores the file and returns. Parsing belongs on a worker, where it can take as long as it needs without a timeout.</P>

      <CodeBlock
        title="yatta/backend/imports.ts"
        code={`import { createAPI, HttpError } from "yatta.js/api";
import { storage } from "../func/storage";
import { jobs } from "../func/jobs";
import { requireAuth } from "../func/middleware";
import { and } from "yatta.js/db";
import { db } from "../func/db";

const route = createAPI("/imports");

route.use(requireAuth);

route.post("/", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;
  const form = await ctx.req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) throw new HttpError(400, "file is required");
  if (file.size > 500 * 1024 * 1024) throw new HttpError(413, "Max 500MB");

  const id = crypto.randomUUID();
  const key = \`imports/\${userId}/\${id}/source.csv\`;

  await storage.put(key).from(file.stream() as never)
    .withContentType("text/csv")
    .asPrivate()
    .maxSize("500mb");

  const row = await db.imports.insert({ id, userId, status: "pending", key });

  await jobs.enqueue("import:run", { importId: id }, { priority: "high" });

  return Response.json(
    { id: row.id, progressUrl: \`/imports/\${id}/progress\` },
    { status: 202 },
  );
});`}
      />

      <H2 id="parse">Stream the file</H2>

      <P>Reading the whole file into a string turns a 400MB upload into 800MB of heap. A line-at-a-time reader keeps it flat regardless of file size.</P>

      <CodeBlock
        title="yatta/func/csv.ts"
        code={`/**
 * RFC 4180 reader: quoted fields, escaped quotes, embedded newlines.
 *
 * A naive split(",") corrupts any field containing a comma — which in a real
 * export is nearly every free-text column.
 */
export async function* readCsv(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string[]> {
  const decoder = new TextDecoder();
  let buffer = "";
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });

    let i = 0;
    while (i < buffer.length) {
      const ch = buffer[i]!;

      if (inQuotes) {
        if (ch === '"') {
          if (buffer[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }

      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ",") { row.push(field); field = ""; i++; continue; }

      if (ch === "\\n" || ch === "\\r") {
        if (ch === "\\r" && buffer[i + 1] === "\\n") i++;
        row.push(field);
        field = "";
        yield row;
        row = [];
        i++;
        continue;
      }

      field += ch; i++;
    }

    buffer = buffer.slice(i);
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    yield row;
  }
}`}
      />

      <H2 id="import">Import in batches</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`export interface JobHandlers {
  "import:run": { importId: string };
}

const BATCH = 500;

jobs.handle("import:run", async ({ importId }, ctx) => {
  const record = await db.imports.findById(importId);
  if (!record) return;

  const file = await storage.disk().download(record.key);

  let batch: Record<string, unknown>[] = [];
  let header: string[] | undefined;
  let seen = 0;
  let skipped = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  try {
    for await (const line of readCsv(file.stream())) {
      if (!header) { header = line; continue; }

      const row = Object.fromEntries(header.map((h, i) => [h, line[i] ?? ""]));

      if (!row.email) {
        skipped++;
        if (errors.length < 100) errors.push({ row: seen + 2, reason: "missing email" });
        continue;
      }

      batch.push({
        userId: record.userId,
        name: row.name ?? "",
        email: row.email,
        createdAt: new Date(),
      });

      seen++;

      if (batch.length >= BATCH) {
        await flush(batch);
        batch = [];

        // Only every few batches, or the update becomes its own bottleneck.
        if (seen % (BATCH * 10) === 0) {
          ctx.progress(Math.min(95, Math.round((seen / 100_000) * 100)), \`\${seen} rows\`);
        }
      }
    }

    if (batch.length > 0) await flush(batch);

    await db.imports.where((f) => f.id.isEqualTo(importId)).update({
      status: "completed",
      rowsImported: seen - skipped,
      rowsSkipped: skipped,
      errors: errors.slice(0, 100),
      finishedAt: new Date(),
    });

    ctx.progress(100, \`\${seen - skipped} imported\`);
  } catch (err) {
    await db.imports.where((f) => f.id.isEqualTo(importId)).update({
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  /** One transaction per batch: atomic, and never a 50k-row transaction. */
  async function flush(rows: Record<string, unknown>[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.users.insert(row as never);
      }
    });
  }
});`}
      />

      <Callout kind="warn">A transaction over the whole file holds a write lock for the entire import and blocks every other writer. Batch it, and commit per batch.</Callout>

      <H2 id="dry-run">Dry run first</H2>

      <CodeBlock
        title="yatta/func/imports.ts"
        code={`route.post("/:id/dry-run", async (ctx) => {
  const record = await db.imports.findById(ctx.params.id);
  if (!record) throw new HttpError(404, "Unknown import");

  const file = await storage.disk().download(record.key);
  let header: string[] | undefined;
  let valid = 0;
  let invalid = 0;
  const problems = new Set<string>();

  for await (const line of readCsv(file.stream())) {
    if (!header) { header = line; continue; }

    const row = Object.fromEntries(header.map((h, i) => [h, line[i] ?? ""]));
    const missing = header.filter((h) => !row[h]);
    if (missing.length > 0) { invalid++; problems.add(\`missing: \${missing.join(", ")}\`); }
    else valid++;
  }

  return Response.json({
    valid, invalid,
    problems: [...problems].slice(0, 20),
    sample: header,
  });
});`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/cron-scheduler", title: "Cron scheduler" }}
        next={{ href: "/docs/examples/analytics", title: "Product analytics" }}
      />
    </article>
  );
}
