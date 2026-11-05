import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Full-text search — YATTA Docs",
  description:
    "Ranked search over your tables, backed by SQLite FTS5: mark columns searchable, search with typo correction and synonyms, and rebuild the index when writes bypass the Table methods.",
};

export default function FullTextSearchDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Full-text search" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Ranked search over your tables, backed by SQLite FTS5 — mark the columns you want searchable in the schema and nothing else needs setting up.">
        Full-text search
      </H1>

      <H2>Marking columns searchable</H2>

      <CodeBlock
        title="Searchable columns in the schema"
        code={`import { col, createDatabase } from "yatta.js/db";

const schema = {
  products: {
    id: col.id(),
    title: col.text().searchable(),
    description: col.text().searchable(),
    internalNote: col.text(), // not searchable: never matched
    price: col.integer(),
  },
};

const db = createDatabase({ path: "Database/app.db", schema });

const hits = db.products.search("laptop");
// hits[0].row — the matched row, most relevant first
// hits[0].rank — the raw FTS5 bm25() value (negative, smaller is better)`}
      />

      <H2>How it works</H2>

      <P>
        Declaring <Code>.searchable()</Code> on a text column creates a
        standalone FTS5 table (<Code>_fts_products</Code>) holding those
        columns plus the row&apos;s primary key, stored unindexed so the key
        itself is never searchable. Ranking is FTS5&apos;s{" "}
        <Code>bm25()</Code> — Yatta does not invent a score.
      </P>

      <P>
        The index stays in sync through the normal write paths:{" "}
        <Code>insert</Code>, <Code>insertMany</Code>, <Code>update</Code>,{" "}
        <Code>updateById</Code>, <Code>delete</Code>, and{" "}
        <Code>upsert</Code>. A transaction rollback rolls index writes back
        with the rows, so the index cannot outlive its row.
      </P>

      <H2>Options</H2>

      <Props
        items={[
          { name: "limit", desc: "Maximum hits to return. Omitted means all matches, most relevant first." },
          { name: "offset", desc: "Hits to skip, for paging through ranked results. Defaults to 0." },
          { name: "columns", desc: "Restrict the search to these columns. Every named column must be searchable; naming a non-searchable column throws instead of silently searching nothing." },
          { name: "where", desc: "Extra rows the search must match, applied after ranking (an AND filter). The ranking itself still comes from the FTS5 match alone." },
          { name: "include", desc: "Eager-loaded relations, same shape as findMany({ include })." },
          { name: "synonyms", desc: "Synonym map for this query only, merged over the database-level map. A key expands to its values." },
          { name: "typo", desc: "Whether typo correction runs. Default true. With it off, only exact FTS5 token matches count." },
        ]}
      />

      <CodeBlock
        title="Paging, one column, and a filter"
        code={`// Paging through ranked results
db.products.search("laptop", { limit: 10, offset: 20 });

// Search only one column — naming a non-searchable column throws
db.products.search("laptop", { columns: ["description"] });

// Combine ranking with an ordinary filter
db.products.search("laptop", { where: { price: { lt: 100 } } });`}
      />

      <H2>Typos</H2>

      <P>
        FTS5 on its own has no typo tolerance: searching{" "}
        <Code>&quot;laptp&quot;</Code> against an index holding{" "}
        <Code>&quot;laptop&quot;</Code> matches nothing. Yatta adds a
        correction layer on top, so this works by default:
      </P>

      <CodeBlock
        title="Typo correction, on by default"
        code={`db.products.search("laptp"); // finds the laptop row
db.products.search("laptp", { typo: false }); // [] — FTS5's honest answer`}
      />

      <P>
        What the layer actually does: each query word that is not already in
        the indexed vocabulary is corrected against that vocabulary — terms
        from the fts5vocab table, or from scanning the searchable columns
        when that table is unavailable. A candidate must share enough
        trigrams with the query word and be within a small edit distance (1
        for short words, 2 for longer ones). The best candidate wins; a word
        with no close neighbour keeps its spelling and matches nothing.
      </P>

      <P>Where it falls short, plainly:</P>

      <UL>
        <LI>
          It corrects one word at a time, against single indexed terms. It
          cannot fix a typo split across words, or a word that is itself two
          words run together.
        </LI>
        <LI>
          A genuinely unknown word can be &ldquo;corrected&rdquo; to a near
          neighbour when one happens to sit within the distance gates. The
          gates keep this rare, but they cannot rule it out — a typo search
          is a best guess, not an exact lookup.
        </LI>
        <LI>
          Correction reads the vocabulary on every typo-enabled search. On
          very large tables that read is the main cost of a search; pass{" "}
          <Code>typo: false</Code> when you need exact matching only.
        </LI>
      </UL>

      <H2>Synonyms</H2>

      <P>
        A synonym map expands the query, at query time — changing it needs
        no reindex. Set it for the whole database, or for one query:
      </P>

      <CodeBlock
        title="Database-level and per-query synonyms"
        code={`const db = createDatabase({
  path: "Database/app.db",
  schema,
  searchSynonyms: { laptop: ["notebook"] },
});

db.products.search("laptop"); // also matches "notebook" rows

// One query only; the database map is untouched
db.products.search("laptop", { synonyms: { laptop: "notebook" } });`}
      />

      <P>
        The map is one-directional: <Code>laptop: [&quot;notebook&quot;]</Code>{" "}
        expands &ldquo;laptop&rdquo; to &ldquo;notebook&rdquo;, not the other
        way round. Add the reverse entry if you want both directions.
      </P>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>Only plain text columns can be{" "}
          <Code>.searchable()</Code>.</strong> Marking a number, boolean,
          JSON column, or UUID key throws at schema definition time.
        </LI>
        <LI>
          <strong>Search input is tokenized before it reaches
          FTS5</strong>, so quotes, wildcards, and FTS5 operators typed into
          a query never act as syntax. There is no OR search in v1: the
          words <Code>and</Code>/<Code>or</Code>/<Code>not</Code> are dropped
          and every remaining term is ANDed.
        </LI>
        <LI>
          <strong><Code>rank</Code> is only meaningful for ordering within
          one query.</strong> Do not rescale it into a 0–1 score or compare
          ranks across different queries.
        </LI>
        <LI>
          <strong>Search returns full rows, including non-searchable
          columns</strong> — the same as <Code>findMany</Code>.
          Non-searchable means &ldquo;never matched on&rdquo;, not{" "}
          &ldquo;hidden&rdquo;.
        </LI>
        <LI>
          <strong>Search is opt-in and lazy:</strong> a table with no{" "}
          <Code>.searchable()</Code> column gets no FTS table and no extra
          work on any write — its write path runs exactly the statements it
          ran before. Only tables that declare searchable columns pay for
          index maintenance, and only from the moment they declare it.
        </LI>
      </UL>

      <H2>Rebuilding the index</H2>

      <P>
        Writes that bypass the Table methods — raw SQL,{" "}
        <Code>exec</Code>, a database file copied in from elsewhere — do not
        sync the index. Rebuild it:
      </P>

      <CodeBlock
        title="Rebuild after out-of-band writes"
        code={`db.products.rebuildSearchIndex(); // one table
db.rebuildSearchIndex(); // every searchable table`}
      />

      <P>
        A search also repairs a missing index, or one whose row count
        disagrees with the table, on first use. Changed text on an existing
        row written outside the Table paths is only fixed by a rebuild, not
        by that repair.
      </P>

      <Callout>
        A table with no searchable columns throws when searched —{" "}
        <code>Table &quot;products&quot; has no searchable columns. Mark a
        text column with .searchable() to make the table searchable.</code>{" "}
        That is a setup error surfacing early, not an empty result.
      </Callout>

      <DocFooter
        prev={{ href: "/docs/shared-change-log", title: "Shared change log" }}
        next={{ href: "/docs/time-series", title: "Time series" }}
      />
    </article>
  );
}
