import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Cloud backups — YATTA Docs",
  description:
    "Scheduled, encrypted snapshots of your databases to an S3-compatible bucket, with automatic retention pruning.",
};

export default function CloudBackupsDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Cloud backups" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Your app's databases are its memory. A disk failure, a bad deploy, or a deleted volume takes all of it, and the local backup file is on the same disk that just failed. Cloud backups fix that: on a schedule, the whole database set is snapshotted, encrypted, and uploaded to an S3-compatible bucket, and old snapshots are pruned automatically.">
        Cloud backups
      </H1>

      <H2>Setting up</H2>

      <P>
        Backups are fully opt-in, and the app wires them up — nothing is
        armed by importing the module. Load the config from the environment,
        build the bucket, and hand both to the scheduler:
      </P>

      <CodeBlock
        title="Wiring it up"
        code={`import { createCron } from "yatta.js/jobs";
import {
  createS3BackupBucket,
  loadCloudBackupConfigFromEnv,
  scheduleCloudBackups,
} from "yatta.js/cloud-backups";

const config = loadCloudBackupConfigFromEnv();
if (config) {
  scheduleCloudBackups(createCron(), config, createS3BackupBucket({
    driver: "s3",
    bucket: config.bucket,
    ...config.s3,
  }));
}`}
      />

      <P>
        <Code>loadCloudBackupConfigFromEnv()</Code> returns <Code>null</Code>{" "}
        when unconfigured — no bucket and no key means no scheduler, no S3
        client, and no backup work at startup. A half-configured setup is an
        error, not a silent skip: a bucket without a key, or a malformed key,
        throws a <Code>CloudBackupError</Code>, because it almost certainly
        means someone meant to have backups and does not.
      </P>

      <Callout kind="warn">
        Real-provider upload and restore are unverified: the backup runner
        was tested only against a fake in-memory bucket, which proves the
        runner&apos;s logic but not Bun&apos;s S3 client against a real
        provider. Verify the first real upload and the first real restore
        against your actual bucket before relying on it.
      </Callout>

      <H2>Configuration</H2>

      <P>
        Secrets come from the environment only. The encryption key in
        particular comes from the environment — never from a file, never from
        code, never from a default.
      </P>

      <CodeBlock
        title="Environment variables"
        code={`# Destination bucket (S3, MinIO, or R2 through the existing S3 driver).
YATTA_BACKUP_BUCKET=my-backups
# S3 endpoint for MinIO/R2. Omit for AWS S3.
S3_ENDPOINT=https://my-account.r2.cloudflarestorage.com
# Credentials follow Bun's S3 lookup: S3_* first, then the AWS_* fallbacks.
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# Encryption key: 32 bytes, as 64 hex characters or base64. Required.
YATTA_BACKUP_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# Optional: schedule, retention, prefix.
YATTA_BACKUP_SCHEDULE="0 2 * * *"   # daily at 02:00 UTC (the default)
YATTA_BACKUP_INTERVAL=24h           # when set, wins over the schedule
YATTA_BACKUP_KEEP_COUNT=7           # keep the newest 7 snapshots (default)
YATTA_BACKUP_KEEP_DAYS=30           # prune snapshots older than 30 days (default, 0 disables)
YATTA_BACKUP_PREFIX=yatta-backups   # object prefix (default)`}
      />

      <H3>Config fields</H3>

      <Props
        items={[
          { name: "bucket", desc: "Destination bucket. Required." },
          { name: "prefix", desc: "Object prefix. Default \"yatta-backups\"." },
          { name: "schedule", desc: "Cron expression, UTC. Default \"0 2 * * *\" (daily at 02:00 UTC)." },
          { name: "interval", desc: "Fixed interval like \"24h\". When set, wins over schedule." },
          { name: "keepCount", desc: "Keep the newest N snapshots. Default 7." },
          { name: "keepDays", desc: "Prune snapshots older than N days. Default 30; 0 disables." },
          { name: "databases", desc: "Database files to snapshot. Defaults to app.db (required), jobs.db and cache.db (optional)." },
          { name: "key", desc: "32-byte encryption key, from YATTA_BACKUP_KEY only." },
          { name: "s3", desc: "Endpoint, region, and credentials for the S3 driver." },
        ]}
      />

      <P>
        A malformed key is never guessed at: a short passphrase is not
        quietly stretched into a key, because a backup made with the wrong key
        is only discovered on restore day. The key must be exactly 32 bytes,
        as 64 hex characters or base64 that decodes to 32 bytes.
      </P>

      <H2>Config file (JSON5)</H2>

      <P>
        Non-secret settings can also live in a hand-edited file, pointed to
        by <Code>YATTA_BACKUP_CONFIG_FILE</Code>. The file is JSON5, so
        comments and trailing commas work. Environment variables win over the
        file for every field.
      </P>

      <CodeBlock
        title="backups.json5"
        code={`{
  // Nightly snapshots to the archive bucket.
  bucket: "my-backups",
  prefix: "nightly",
  schedule: "0 3 * * *",
  keepCount: 3,
  keepDays: 14,
}`}
      />

      <P>
        The file may set <Code>bucket</Code>, <Code>prefix</Code>,{" "}
        <Code>schedule</Code>, <Code>interval</Code>, <Code>keepCount</Code>,{" "}
        <Code>keepDays</Code>, <Code>endpoint</Code>, <Code>region</Code>, and{" "}
        <Code>databases</Code> — and nothing else. The encryption key and
        bucket credentials are environment-only, and a file that tries to set
        them (<Code>key</Code>, <Code>secretAccessKey</Code>, and friends) is
        rejected outright, as is an unknown field, so a typo fails loudly
        instead of silently doing nothing. A file database set must still keep
        a required entry (<Code>app.db</Code>); a set with no required file is
        a configuration error.
      </P>

      <H2>What is backed up</H2>

      <P>
        The backup set is explicit, and it is one encrypted object per run:
      </P>

      <CodeBlock
        code={`// app.db — REQUIRED. The main database (DATABASE_URL, else
// DATABASE_PATH, else Database/app.db). Users, sessions, passkeys,
// and application tables all live here. A run with app.db missing
// fails outright — nothing is uploaded and nothing is pruned.

// jobs.db — OPTIONAL. Absent, it is skipped and noted in the manifest;
// the run still succeeds.

// cache.db — OPTIONAL. A cache is rebuildable, so it is included when
// present for a complete restore, never required.

// A custom SQLite file can be added through "databases" in the config,
// required or optional.`}
      />

      <P>
        Each file is snapshotted with <Code>VACUUM INTO</Code>, the same
        online-safe mechanism <Code>db.backup()</Code> uses: a fresh,
        self-contained database written in one transaction, including anything
        still in the WAL. Live files are never copied directly, so a snapshot
        taken while writers are active is still consistent. The snapshot runs
        on the scheduler tick, never on a request path, and the upload that
        follows is async.
      </P>

      <H2>Running a backup by hand</H2>

      <CodeBlock
        code={`import { CloudBackupRunner, createS3BackupBucket } from "yatta.js/cloud-backups";

const runner = new CloudBackupRunner({ config, bucket: createS3BackupBucket({
  driver: "s3",
  bucket: config.bucket,
  ...config.s3,
}) });
const result = await runner.run();
// { key: "yatta-backups/2026-11-05T02-00-00-000Z-<rand>.ybk",
//   files: [{ name: "app.db", size: 12345 }], skipped: ["cache.db"], pruned: [...] }`}
      />

      <P>
        A failed upload prunes nothing, and a run that is already in flight
        throws rather than overlapping. The cron scheduler also skips a tick
        that is still running. If you run several workers, arm the schedule
        on one of them — the framework does not elect a leader for you.
      </P>

      <H2>Encryption</H2>

      <P>
        Every object is encrypted with AES-256-GCM under{" "}
        <Code>YATTA_BACKUP_KEY</Code> before upload. The manifest — file
        names, sizes, hashes — lives inside the encrypted payload, so even
        the file list is not visible to anyone holding the object but not the
        key. The key is never written to disk beside a backup, never put in
        backup metadata, and never logged. Bucket credentials are scrubbed
        from log lines the same way, even when they appear inside an error
        message from the storage driver.
      </P>

      <P>
        Without the key, an object is opaque: it does not open as SQLite, and
        decryption fails rather than producing partial data. A flipped byte
        or a truncated upload fails the same way, because the GCM
        authentication tag covers the whole payload.
      </P>

      <H2>Restore</H2>

      <P>
        Restore is the reverse, and it never touches a live database on its
        own. It downloads, decrypts, hash-verifies every file, and
        integrity-checks each SQLite file (<Code>quick_check</Code>, plus a
        schema check for required files, so an empty file cannot restore as a
        wiped database). The verified files are staged in a directory you
        choose; from there, move the staged <Code>app.db</Code> into place
        with <Code>db.restore()</Code>, which runs its own integrity check
        and atomic swap.
      </P>

      <CodeBlock
        code={`import { restoreCloudBackup, parseBackupKey, createS3BackupBucket } from "yatta.js/cloud-backups";

const bucket = createS3BackupBucket({
  driver: "s3",
  bucket: config.bucket,
  ...config.s3,
});

const restored = await restoreCloudBackup({
  bucket,
  key: "yatta-backups/2026-11-05T02-00-00-000Z-<rand>.ybk",
  keyMaterial: parseBackupKey(process.env.YATTA_BACKUP_KEY!),
  outDir: "./restore-staging",
});
// Then, for the live database:
db.restore(restored.files.find((f) => f.name === "app.db")!.path);`}
      />

      <P>
        A tampered or wrong-key object fails here, before any live file is
        touched. A restore with the wrong key and a restore of a tampered
        object produce the same generic error on purpose: distinguishing them
        would tell an attacker holding the object whether a guessed key was
        close.
      </P>

      <H2>Retention</H2>

      <P>
        After each successful upload, old snapshots are pruned: anything past{" "}
        <Code>YATTA_BACKUP_KEEP_COUNT</Code>, or older than{" "}
        <Code>YATTA_BACKUP_KEEP_DAYS</Code>, goes. Three rules keep pruning
        safe:
      </P>

      <CodeBlock
        code={`// The newest snapshot is never deleted, even when it is older
// than the age limit. An old newest snapshot is still the only one.
// The snapshot this run just uploaded is never deleted.
// Keys the pruner cannot parse, and objects outside the prefix
// directory, are kept. Pruning deletes only snapshots it can
// positively identify as its own and old.

// A failed upload prunes nothing, and a failed listing skips pruning
// entirely rather than guessing. A failed delete leaves that object
// for the next run.`}
      />

      <H2>Gotchas</H2>

      <P>
        <strong>Snapshots are full, every time.</strong> Each run uploads
        every database file again, encrypted. There is no incremental backup
        here, on purpose: true incremental backup rides the replication WAL
        transport from the future replication feature, and a second,
        half-correct incremental scheme would be worse than full snapshots.
        Size your bucket and your schedule with that in mind.
      </P>

      <P>
        <strong>Lose the key, lose the backups.</strong> There is no recovery
        path: no key escrow, no alternate decryption, no plaintext copy
        anywhere. Rotate keys by taking a fresh backup under the new key and
        keeping at least one snapshot under the old key until the new one is
        verified.
      </P>

      <Callout kind="warn">
        Plaintext exists briefly, twice. Snapshot files sit unencrypted in the
        OS temp directory while a run packs them (each is deleted as soon as
        its bytes are read, and the scratch directory is removed when the run
        ends, but a crash mid-run can leave one behind). Restored files are
        plaintext by definition — delete the staging directory once the
        restore is done, and do not stage restores in a shared directory.
      </Callout>

      <P>
        <strong>Restore needs the owners stopped for jobs and cache.</strong>{" "}
        <Code>db.restore()</Code> handles the live app database safely. For{" "}
        <Code>jobs.db</Code> and <Code>cache.db</Code>, put the staged files
        back while their owners are stopped, or the live process keeps
        writing to the file you just replaced.
      </P>

      <Note>
        Backups use nothing a compiled binary cannot do: no dynamic code
        loading, no <code>eval</code>, no runtime <code>require</code> of user
        paths — just <code>bun:sqlite</code>, <code>node:crypto</code>, and
        the S3 client. The feature sets no runtime flags and needs none.
      </Note>

      <DocFooter
        prev={{ href: "/docs/standalone-build", title: "Standalone binary" }}
        next={{ href: "/docs/storage-tiering", title: "Storage tiering" }}
      />
    </article>
  );
}
