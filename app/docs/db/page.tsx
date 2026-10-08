import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Database — YATTA Docs",
  description:
    "A typed SQLite ORM for Bun: a column builder, relations, transactions, migrations, and an English-like query DSL.",
};

export default function DbDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Database" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="An embedded SQLite layer with types inferred from your schema. WAL mode is enabled automatically, so several processes can share one file safely.">
        Database
      </H1>

      <H2>Defining a schema</H2>

      <P>
        The schema is a plain object built with <Code>col</Code>. Row types are
        inferred from it — there is no generation step and no schema file to
        keep in sync.
      </P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta.js/db";

export const schema = {
  users: {
    id: col.uuid(),
    email: col.text().unique(),
    name: col.text(),
    roles: col.json<string[]>().default(["user"]),
    verified: col.boolean().default(false),
    profile: col.json<Record<string, unknown>>().nullable(),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  },
  posts: {
    id: col.id(),
    title: col.text(),
    body: col.text().default(""),
    published: col.boolean().default(false),
    authorId: col.text().references("users.id", { onDelete: "CASCADE" }),
    createdAt: col.createdAt(),
  },
};

// Makes db.users and db.posts fully typed.
declare module "yatta.js/db" {
  interface Register {
    schema: typeof schema;
  }
}

export const db = createDatabase({
  path: process.env.DATABASE_URL || "Database/app.db",
  schema,
});`}
      />

      <H3>Column builders</H3>

      <Props
        items={[
          { name: "col.id()", desc: "Auto-incrementing integer primary key." },
          { name: "col.uuid()", desc: "Generated UUID primary key." },
          { name: "col.text()", desc: "Text column." },
          { name: "col.integer()", desc: "Integer column." },
          { name: "col.real()", desc: "Floating point column." },
          { name: "col.boolean()", desc: "Boolean, stored as integer." },
          { name: "col.json<T>()", desc: "JSON, serialized and parsed for you." },
          { name: "col.date()", desc: "Timestamp." },
          { name: "col.createdAt()", desc: "Timestamp, set on insert." },
          { name: "col.updatedAt()", desc: "Timestamp, refreshed on update." },
        ]}
      />

      <H3>Modifiers</H3>

      <CodeBlock
        code={`col.text().unique()                       // UNIQUE constraint
col.text().nullable()                     // allows NULL
col.text().default("pending")             // DEFAULT value
col.integer().default(1)
col.text().references("users.id", { onDelete: "CASCADE" })
col.text().hasMany("posts")               // relation
col.text().belongsTo("users")             // relation`}
      />

      <H2>Reading and writing</H2>

      <CodeBlock
        title="CRUD"
        code={`// Insert — returns the created row
const user = db.users.insert({
  email: "ada@example.com",
  name: "Ada",
});

db.users.insertMany([
  { email: "a@example.com", name: "A" },
  { email: "b@example.com", name: "B" },
]);

// Read
const byId   = db.users.findById(user.id);
const first  = db.users.findFirst({ where: { verified: true } });
const admins = db.users.findMany({
  where: { roles: { contains: "admin" } },
  orderBy: { createdAt: "desc" },
  take: 20,
});

// Update
db.users.updateById(user.id, { name: "Ada L." });

// Delete
db.users.deleteById(user.id);
db.users.delete({ where: { verified: false } });

// Upsert
db.apiKeys.upsert({
  where: { id: "key_1" },
  create: { id: "key_1", userId: user.id },
  update: { lastUsedAt: new Date() },
});

// Count
const total = db.users.count();`}
      />

      <H2>The query DSL</H2>

      <P>
        <Code>where</Code> accepts an object of comparisons. Combine them with{" "}
        <Code>AND</Code> and <Code>OR</Code>.
      </P>

      <CodeBlock
        title="Filtering"
        code={`db.posts.findMany({
  where: {
    AND: [
      { published: true },
      { authorId: user.id },
      { title: { contains: "bun" } },
    ],
  },
});

// Operators
{ gt: 100 }        // greater than
{ lt: 10 }         // less than
{ gte: 1 }         // greater or equal
{ lte: 1 }         // less or equal
{ ne: "x" }        // not equal
{ contains: "bun" }// LIKE %bun%
{ in: ["a", "b"] }
{ like: "A%" }
{ isNull: true }`}
      />

      <P>
        The same operators work on date columns. Because a date column is stored
        as text, write the value in ISO-8601 —{" "}
        <Code>{"2026-01-31T00:00:00.000Z"}</Code>. Comparison is lexicographic,
        so ISO is what makes a range mean what you expect.
      </P>

      <CodeBlock
        title="Date ranges"
        code={`db.posts.findMany({
  where: {
    createdAt: { gte: "2026-01-01T00:00:00.000Z", lt: "2026-02-01T00:00:00.000Z" },
  },
  orderBy: { createdAt: "desc" },
});

// Non-null only — isNull and the comparison operators are separate.
db.posts.findMany({ where: { deletedAt: { isNull: true } } });`}
      />

      <Callout kind="note">
        <Code>col.createdAt()</Code> and <Code>col.updatedAt()</Code> write ISO-8601
        themselves, so a column you never touch by hand is safe to range over. They
        used to fall back to SQLite&apos;s{" "}
        <code>CURRENT_TIMESTAMP</code>, which drops the <code>T</code> and the
        <code>Z</code> — and since a space sorts before a letter, every
        never-updated row in a column fell <em>below</em> any ISO cutoff. A table
        created before that fix keeps its old default; change it with{" "}
        <code>ALTER TABLE t ALTER COLUMN c SET DEFAULT</code> and normalise the
        rows already stored.
      </Callout>

      <H2>Pagination</H2>

      <CodeBlock
        title="Offset and cursor"
        code={`// Page numbers
const page = db.posts.paginate({ page: 2, limit: 20 });
// → { data, total, page, limit, totalPages }

// Keyset — stays fast on large tables
const feed = db.posts.cursorPaginate({ limit: 15, cursor: lastCursor });
// → { data, nextCursor, hasMore }`}
      />

      <P>
        <Code>page</Code> and <Code>limit</Code> are clamped rather than
        validated, because a page number that is not a number is a caller that
        forgot the parameter rather than an attack:{" "}
        <Code>Math.max(1, NaN)</Code> is <Code>NaN</Code>, so{" "}
        <Code>paginate({"{ page: Number(q.page), limit: 20 }"})</Code> with{" "}
        <Code>q.page</Code> absent used to reach SQLite as an offset of{" "}
        <code>NaN</code> and surface as &ldquo;no such column: NaN&rdquo;. It
        now takes the documented default. A fractional page is floored.
      </P>

      <P>
        <Code>skip</Code> and <Code>take</Code> are different: both are
        interpolated into the SQL, so both are <em>validated</em> and reject
        anything that is not a non-negative integer with a{" "}
        <Code>YattaError</Code> naming the field. Previously a non-numeric offset
        produced SQLite&apos;s own error — &ldquo;no such column: NaN&rdquo; for{" "}
        <Code>"abc"</Code>, &ldquo;datatype mismatch&rdquo; plus the whole
        statement for <Code>1.7</Code> — and a negative one was read as{" "}
        <code>0</code>, silently returning from the start.{" "}
        <Code>take: -1</Code> stays legal: it is SQLite&apos;s own unbounded
        read.
      </P>

      <Callout>
        A <Code>where</Code> that is not an object is rejected rather than
        ignored. <Code>Object.keys(fn)</Code> is <code>[]</code>, so{" "}
        <code>findMany({"{ where: (f) => f.tenantId.isEqualTo(id) }"})</code>{" "}
        compiled to no filter at all and returned <em>every</em> row — a filter
        that reads correct and behaves as its absence. TypeScript rejects that
        form, so it arrived through an <code>any</code> at a handler boundary or
        from plain JavaScript. Use the object form, or{" "}
        <code>db.users.where((f) =&gt; f.tenantId.isEqualTo(id)).all()</code>,
        which is where the <code>and</code>/<code>or</code> helpers belong —
        they need the field proxy that <code>where</code> hands its callback.
      </Callout>

      <H2>Transactions</H2>

      <P>
        Nested calls use savepoints, so a helper that opens a transaction can be
        composed safely inside a larger one.
      </P>

      <CodeBlock
        title="Transactions"
        code={`const result = db.transaction(() => {
  const user = db.users.insert({ email: "ada@example.com", name: "Ada" });

  db.posts.insert({
    title: "Hello",
    authorId: user.id,
  });

  return user;
});

// Nested — opens a SAVEPOINT instead
db.transaction(() => {
  db.users.insert({ email: "a@example.com", name: "A" });
  db.transaction(() => {
    db.posts.insert({ title: "Nested", authorId: "..." });
  });
});`}
      />

      <H2>Relations</H2>

      <CodeBlock
        title="Eager loading"
        code={`const post = db.posts.findById("1", {
  include: { author: true },
});

const posts = db.posts.findMany({
  include: { author: true, comments: true },
  take: 50,
});`}
      />

      <H2>Raw SQL</H2>

      <P>
        When the DSL is not the right tool, the underlying handle is available.
      </P>

      <CodeBlock
        title="Raw access"
        code={`const rows = db.sql.query(
  \`SELECT p.*, u.name AS author
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.published = 1
     ORDER BY p.created_at DESC
     LIMIT 50\`
).all();

db.sql.exec("VACUUM;");`}
      />

      <H2>Schema changes</H2>

      <P>
        Tables are created and new columns added on open, without a migration step. Two
        cases are worth knowing about because they are not uniform:
      </P>

      <UL>
        <LI>
          A column with a <em>constant</em> default is added with{" "}
          <code>ALTER TABLE ADD COLUMN</code> and existing rows get that value.
        </LI>
        <LI>
          A <code>col.createdAt()</code> or <code>col.updatedAt()</code> added to a
          table that already has rows needs the table rebuilt, because SQLite refuses an
          expression default on an existing populated table. Yatta does this
          automatically, backfilling every row.
        </LI>
      </UL>

      <P>
        The rebuild preserves what it should: the AUTOINCREMENT counter (so ids do not
        restart), indexes and triggers on the table, columns the schema no longer
        mentions, and other tables&apos; foreign keys. It runs inside the same{" "}
        <code>BEGIN IMMEDIATE</code> as the rest of the sync, so it is all-or-nothing.
      </P>

      <H2>Backups</H2>

      <CodeBlock
        code={`// Online backup — safe while the app is running
await db.backup("Database/backups/app.db");

// Restore, with rollback on failure
await db.restore("Database/backups/app.db");`}
      />

      <P>
        <code>restore</code> validates before it replaces anything, and rejects more
        than corruption: a file that is not SQLite, a truncated file, and an{" "}
        <strong>empty</strong> one. The last case is the one worth calling out, because
        it is not obvious from SQLite&apos;s own behaviour — a zero-length file is a
        valid empty database, so <code>PRAGMA quick_check</code> answers{" "}
        <code>ok</code> for it. Validating on integrity alone meant such a restore
        reported success and left you with no tables at all, and{" "}
        <code>checkIntegrity()</code> still said <code>true</code> afterwards. A backup
        must therefore contain a schema; one with tables and no rows is still a
        legitimate backup and restores normally.
      </P>

      <Callout>
        Worth testing in your own recovery drill: <code>restore</code> reopens the file
        but does not re-run the schema sync, so restoring a snapshot taken before a
        schema change leaves the live database at the older shape until something
        recreates the difference.
      </Callout>

      <H2>Multi-process safety</H2>

      <P>
        Every connection is opened with these pragmas:
      </P>

      <CodeBlock
        title="Applied automatically"
        lang="sql"
        code={`PRAGMA journal_mode = WAL;    -- readers proceed during writes
PRAGMA busy_timeout = 5000;    -- wait for a lock instead of throwing
PRAGMA synchronous = NORMAL;   -- safe under WAL, fewer fsyncs
PRAGMA foreign_keys = ON;`}
      />

      <Note kind="warn">
        Schema creation runs under <Code>BEGIN IMMEDIATE</Code> and retries on
        contention, so mounting the same schema across many worker threads at
        boot is safe. Under heavy concurrency the L2 cache store also retries —
        see <a href="/docs/reliability" className="underline underline-offset-4">Reliability</a>.
      </Note>

      <DocFooter
        prev={{ href: "/docs/jobs", title: "Jobs & events" }}
        next={{ href: "/docs/auth", title: "Authentication" }}
      />
    </article>
  );
}
