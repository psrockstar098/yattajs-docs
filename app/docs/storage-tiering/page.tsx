import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Storage tiering — YATTA Docs",
  description:
    "Move files nobody has touched to S3 while reads keep working: writes land hot, reads fall through, and the mover copies, verifies, then deletes.",
};

export default function StorageTieringDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Storage tiering" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Your local disk fills up with files nobody opens any more, while an S3 disk sits configured and unused. Tiering moves the files nobody has touched for a while to the S3 disk, and keeps serving them from there. Callers use one storage handle and never need to know where a file lives.">
        Storage tiering
      </H1>

      <H2>Setting up</H2>

      <CodeBlock
        title="Two disks, one handle"
        code={`import { createStorage } from "yatta.js/storage";
import { createTieredStorageFromManager } from "yatta.js/storage-tiering";

const storage = createStorage({
  default: "local",
  publicReads: true,
  disks: {
    local: { driver: "local", baseDir: "./storage/uploads", publicUrl: "/storage/files" },
    s3: {
      driver: "s3",
      bucket: process.env.S3_BUCKET!,
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
});

// Null when tiering cannot activate — see "Both disks, or nothing" below.
const tiered = createTieredStorageFromManager(storage, { staleAfter: "30d" });`}
      />

      <Callout kind="warn">
        Live S3 moves are untested against a real provider: the mover was
        verified against local and fake disks, not a live bucket. Run the
        mover once against your real bucket and check a moved file serves
        from S3 before letting it move files you care about.
      </Callout>

      <H2>One handle in every handler</H2>

      <P>
        Attach storage to the router once, and every handler gets it as{" "}
        <Code>ctx.storage</Code>. A router built after its storage can use{" "}
        <Code>api.withStorage(storage)</Code> instead of the constructor
        option, and a mounted child router inherits its parent&apos;s storage
        when it has none of its own. When no storage is configured,{" "}
        <Code>ctx.storage</Code> is undefined — handlers must check, not
        assume.
      </P>

      <CodeBlock
        code={`import { createAPI, API } from "yatta.js/api";

const api = createAPI({ storage: tiered ?? storage });

api.post("/upload", async (ctx) => {
  const form = await ctx.formData();
  const file = form.get("file") as File;
  await ctx.storage!.save("uploads/report.pdf", file);
  return API.json({ ok: true });
});

api.get("/files/:name", async (ctx) => {
  const text = await ctx.storage!.file(\`uploads/\${ctx.params.name}\`).text();
  return API.text(text);
});`}
      />

      <P>
        <Code>ctx.storage.save(key, data)</Code> is a plain upload under one
        name. The full file handle works too:{" "}
        <Code>ctx.storage.file(key).put(data)</Code>, <Code>.text()</Code>,{" "}
        <Code>.serve(req)</Code>, <Code>.delete()</Code>.
      </P>

      <H2>Writes land hot, reads fall through</H2>

      <P>
        Writes always go to the local disk. Reads try local first, then S3,
        so a file serves while it is being moved and after it moved. A save
        over a moved file writes the new version locally and drops the stale
        S3 copy, so there is never a version split across disks.
      </P>

      <CodeBlock
        code={`await tiered.save("reports/annual.pdf", pdfBytes);
await tiered.file("reports/annual.pdf").text(); // local, then S3 after a move
await tiered.tierOf("reports/annual.pdf"); // "hot" | "cold" | "moving" | "missing"`}
      />

      <H2>The mover — copy, verify, delete, in that order</H2>

      <P>
        The mover runs only when the app runs it. It lists the local disk,
        moves every file untouched for at least <Code>staleAfter</Code>, and
        reports per file. One file&apos;s failure is recorded and the run
        continues.
      </P>

      <CodeBlock
        code={`import { createCron } from "yatta.js/jobs"; // app's existing cron scheduler
import { scheduleTiering } from "yatta.js/storage-tiering";

const cron = createCron();

// Arm it once — the mover runs on the scheduler you pass it.
scheduleTiering(cron, tiered, "1h");

// Or as a job handler, for apps that run tiering as a job:
import { createTieringJobHandler } from "yatta.js/storage-tiering";
const runTiering = createTieringJobHandler(tiered);
const result = await runTiering();
// { moved: [...], promoted: [...], skipped: [...], failed: [...] }`}
      />

      <P>
        The move itself is copy, then verify, then delete — never
        delete-first:
      </P>

      <CodeBlock
        code={`// 1. Copy the file from local to S3.
// 2. Verify the copy: same size and same content hash as the source.
// 3. Only then delete the local file.

// A failed verification leaves the local file intact and removes the
// unverified S3 copy, so a later read cannot pick it up. An interrupted
// move (crash, failed copy) leaves the same state: local intact, and the
// next run copies again from scratch. The mover is idempotent for
// exactly this reason — a file present on both disks is just copied
// over and then deleted locally.`}
      />

      <P>
        A file being moved still serves: reads do not wait on the mover, they
        try local first and fall through to S3. Per-file locks serialize
        moves, saves, deletes, and promotes for one key, so a save during a
        move cannot be deleted by the move that was already in flight.
      </P>

      <H2>Access tracking — reads and writes count, heads do not</H2>

      <P>
        Every read and write through tiered storage records last access for
        the file. A file with no access record uses its last-modified time, so
        files written before tiering started still age out. A metadata check
        (<Code>head</Code>) is not an access: checking that a file exists must
        not keep it local forever.
      </P>

      <H2>Promote-back — off by default, on purpose</H2>

      <P>
        A cold file stays cold no matter how often it is read, unless the app
        opts in. When it opts in, a file that gets hot again is copied back to
        local (verified, same as a move) once it crosses the threshold.
      </P>

      <CodeBlock
        code={`const tiered = createTieredStorageFromManager(storage, {
  staleAfter: "30d",
  promoteBack: true,
  promoteAfterReads: 3, // cold reads inside one window that trigger a promote
  promoteWindowMs: 24 * 60 * 60 * 1000, // window for counting those reads
});`}
      />

      <P>
        Promotion happens on the read that crosses the threshold, so the file
        is already local when that read returns. Keep the threshold above 1:
        promoting on a single read would bounce a file back and forth on
        every mover run.
      </P>

      <H3>Config options</H3>

      <Props
        items={[
          { name: "staleAfter", desc: "How long a file must go untouched before it is a move candidate. A duration string like \"30d\" (the default) or seconds as a number." },
          { name: "staleAfterMs", desc: "Same threshold in milliseconds. Wins over staleAfter when set." },
          { name: "promoteBack", desc: "Copy a file back to local when it gets hot again. Off by default." },
          { name: "promoteAfterReads", desc: "Cold reads inside one window that trigger a promote. Defaults to 3." },
          { name: "promoteWindowMs", desc: "Promote-counting window in milliseconds. Defaults to one day." },
          { name: "hotDisk", desc: "Name of the hot disk. Defaults to the manager's default disk." },
          { name: "coldDisk", desc: "Name of the cold disk. Defaults to the first S3 disk found." },
        ]}
      />

      <H2>Config file (JSON5)</H2>

      <P>
        Tiering config can live in a file instead of code. It accepts JSON5 —
        comments, trailing commas, unquoted keys, single-quoted strings — as
        well as plain JSON, so a hand-edited file stays friendly.
      </P>

      <CodeBlock
        code={`import { loadTieringConfig, createTieredStorageFromManager } from "yatta.js/storage-tiering";

const tiered = createTieredStorageFromManager(storage, await loadTieringConfig("./tiering.json5"));`}
      />

      <CodeBlock
        title="tiering.json5"
        code={`// tiering.json5 — stale after a month, promote back when hot again.
{
  staleAfter: '30d',
  promoteBack: true,
  promoteAfterReads: 3,
}`}
      />

      <P>
        Only serializable fields are allowed (<Code>staleAfter</Code>,{" "}
        <Code>staleAfterMs</Code>, <Code>promoteBack</Code>,{" "}
        <Code>promoteAfterReads</Code>, <Code>promoteWindowMs</Code>,{" "}
        <Code>hotDisk</Code>, <Code>coldDisk</Code>). Unknown fields, wrong
        types, and out-of-range values throw naming the field, so a typo fails
        loudly instead of being ignored. Function-valued options (a custom{" "}
        <Code>verify</Code>, a clock, callbacks, a tracker) still come from
        code, never from a file.
      </P>

      <H2>Both disks, or nothing</H2>

      <P>
        Tiering activates only when a local disk and an S3 disk are both
        configured. A single-disk app gets nothing from it: no mover, no
        tracking, and <Code>createTieredStorageFromManager</Code> returns
        null — the caller keeps using the plain manager. Two local disks do
        not activate it either, and a named hot disk that is not local (or a
        cold disk that is not S3) is also null rather than a silent
        misconfiguration. No S3 call is made to decide this: the check looks
        at configured driver kinds only, and constructing an S3 disk makes no
        network request (Bun&apos;s S3 file references are lazy).
      </P>

      <H2>Gotchas</H2>

      <P>
        <strong>Copy-verify-delete is the whole safety story.</strong> Never
        delete a source file on the strength of a copy call returning. Verify
        size plus content hash first. Etags cannot be compared across disks:
        an S3 etag and a local etag have different formats for the same bytes,
        so tiering never compares them.
      </P>

      <P>
        <strong>Credentials come from the disk config, from the environment,
        set before Bun starts.</strong> Bun reads S3 credentials from the
        environment at startup (falling back from <Code>S3_*</Code> names to{" "}
        <Code>AWS_*</Code> names); setting them later does not take effect.
        Tiering never reads, logs, or prints a credential, and its error
        messages name only the key.
      </P>

      <P>
        <strong>Keys with <Code>..</Code> segments are rejected, not
        normalised.</strong> The base storage layer normalises{" "}
        <Code>tenant-a/../tenant-b/file</Code> into{" "}
        <Code>tenant-b/file</Code>, which crosses a tenant prefix. Tiering
        rejects any key containing a <Code>..</Code> segment outright, so a
        tiered key can never address a sibling prefix. This is stricter than
        plain storage, on purpose, and only applies to tiered paths.
      </P>

      <P>
        <strong>Access records live in memory by default.</strong> A restart
        loses them, and files fall back to last-modified time for staleness.
        An app that needs records to survive a restart can pass its own
        tracker behind the <Code>AccessTracker</Code> interface.
      </P>

      <P>
        <strong>The mover lists the local disk, up to 10,000 files per
        run.</strong> Beyond that, split by prefix or run more often; the run
        result tells you what moved, what was skipped, and what failed.
      </P>

      <P>
        <strong>Tiering is not a backup.</strong> A moved file exists in
        exactly one place after the move completes. If the S3 copy must also
        survive a bucket loss, that is a replication concern, not tiering.
      </P>

      <P>
        <strong>Going around the tiered handle bypasses its
        guarantees.</strong> A file written or deleted through a raw disk
        handle is not access-tracked, is not covered by the per-key move
        lock, and can race a move in flight. App code should use the tiered
        handle (or <Code>ctx.storage</Code>) for files tiering owns; the
        mtime fallback is what still ages directly-written files out.
      </P>

      <Note>
        Verification reads both copies in full. That is the price of the
        guarantee, and it is paid once per move, not per read. For very large
        files, prefer a longer <code>staleAfter</code> so the cost is rare.
      </Note>

      <DocFooter
        prev={{ href: "/docs/cloud-backups", title: "Cloud backups" }}
        next={{ href: "/docs/vector-search", title: "Vector search" }}
      />
    </article>
  );
}
