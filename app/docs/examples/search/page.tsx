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
  title: "Full-text search — YATTA Examples",
  description:
    "SQLite FTS5 full-text search with a synchronised index, ranked results, and a cached query layer.",
};

export default function SearchExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Full-text search" },
        ]}
      />

      <H1 eyebrow="Examples" sub="FTS5 with a synchronised index, ranked results, and a cache that does not go stale.">
        Full-text search
      </H1>

      <H2 id="index">The virtual table</H2>

      <P>FTS5 lives beside your data, not in a separate service. The table is declared in the migration hook so it is created on first boot.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta/db";

export const schema = {
  posts: {
    id: col.uuid(),
    authorId: col.text().references("users.id", { onDelete: "CASCADE" }),
    title: col.text(),
    body: col.text(),
    slug: col.text().unique(),
    createdAt: col.createdAt(),
  },
};

export const db = createDatabase({ url: process.env.DATABASE_URL, schema });

/**
 * Create the FTS table and its triggers.
 *
 * Triggers rather than application writes: nothing can then insert or update a
 * post without the index following, including a raw \`db.run()\` from a script.
 */
export function initSearch(): void {
  db.run(\`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title,
      body,
      content='posts',
      content_rowid='rowid',
      tokenize='porter unicode61'
    );
  \`);

  db.run(\`
    CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid, title, body)
      VALUES (new.rowid, new.title, new.body);
    END;
  \`);

  db.run(\`
    CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts, rowid, title, body)
      VALUES ('delete', old.rowid, old.title, old.body);
    END;
  \`);

  db.run(\`
    CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts, rowid, title, body)
      VALUES ('delete', old.rowid, old.title, old.body);
      INSERT INTO posts_fts(rowid, title, body)
      VALUES (new.rowid, new.title, new.body);
    END;
  \`);
}`}
      />

      <H2 id="query">Query it</H2>

      <P><code>bm25</code> returns a score where lower is better. Select it, order by it, and the ranking is free.</P>

      <CodeBlock
        title="yatta/func/search.ts"
        code={`import { z } from "zod";

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export async function search(
  input: z.infer<typeof searchSchema>,
): Promise<{ hits: SearchHit[]; total: number }> {
  const { q, limit, offset } = searchSchema.parse(input);

  // Quote the term so FTS treats punctuation as syntax, not as a crash.
  const match = q.replace(/"/g, '""');

  const total = Number(
    db.run(\`SELECT COUNT(*) AS n FROM posts_fts WHERE posts_fts MATCH ?\`, [match], "get")?.n ?? 0,
  );

  const rows = db.run(
    \`SELECT p.id, p.title,
            snippet(posts_fts, 1, '<mark>', '</mark>', '…', 24) AS snippet,
            bm25(posts_fts, 8.0, 1.0) AS score
       FROM posts_fts
       JOIN posts p ON p.rowid = posts_fts.rowid
      WHERE posts_fts MATCH ?
      ORDER BY score
      LIMIT ? OFFSET ?\`,
    [match, limit, offset],
    "all",
  );

  return { hits: rows, total };
}`}
      />

      <Callout kind="warn">A user-supplied term containing <code>-</code>, <code>*</code> or an unbalanced quote is a syntax error, not an empty result. Double any embedded quotes and wrap the whole term, as above.</Callout>

      <H2 id="cache">Cache the query</H2>

      <CodeBlock
        title="yatta/backend/search.ts"
        code={`import { createAPI } from "yatta/api";
import { cache } from "../func/cache";
import { search, searchSchema } from "../func/search";

const route = createAPI("/search");

route.get("/", async (ctx) => {
  const parsed = searchSchema.safeParse(ctx.query());

  // 400 on a bad query, never 500 from deep inside FTS.
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const key = \`search:\${parsed.data.q}:\${parsed.data.limit}:\${parsed.data.offset}\`;

  return Response.json(
    // A short TTL: search results are cheap to recompute and expensive to
    // serve stale.
    await cache.remember(key, () => search(parsed.data), {
      ttl: "60s",
      tags: ["search"],
    }),
  );
});`}
      />

      <H2 id="rebuild">Rebuild the index</H2>

      <P>If the triggers were ever missing, the index can be rebuilt from the source rows without a dump and restore.</P>

      <CodeBlock
        title="yatta/func/search.ts"
        code={`/** Rebuild posts_fts from scratch. Safe to re-run. */
export function rebuildIndex(): void {
  db.run("INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')");
  observer.log.info("Rebuilt search index");
}`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/rate-limited-api", title: "Rate-limited API" }}
        next={{ href: "/docs/examples/notification-hub", title: "Notification hub" }}
      />
    </article>
  );
}
