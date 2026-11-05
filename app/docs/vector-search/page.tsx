import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Vector search — YATTA Docs",
  description:
    "Store embeddings and search by cosine similarity, with a vec0 backend when installed and a plain-SQLite fallback when it is not.",
};

export default function VectorSearchDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Vector search" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Store embeddings and search by similarity, ranked by cosine similarity. No new service, no new dependency, no cost until you use it: the vectors module loads on first db.vectors access, and nothing is created or loaded before the first vector call.">
        Vector search
      </H1>

      <H2>Storing and searching</H2>

      <CodeBlock
        code={`import { createDatabase } from "yatta.js/db";

const db = createDatabase({ path: "Database/app.db", schema });

db.vectors.upsert("docs", {
  id: "getting-started",
  embedding: [0.12, -0.44 /* ... */],
  metadata: { title: "Getting started" },
});

const hits = db.vectors.search("docs", [0.1, -0.4 /* ... */]);
// hits[0].id — the most similar vector's id
// hits[0].score — cosine similarity, 1 is identical, -1 is opposite
// hits[0].metadata — whatever you stored with it`}
      />

      <Callout kind="warn">
        The shipped default is the plain-SQLite fallback. The vec0 backend is
        opt-in by installation only: Yatta ships no vec0 binary and never
        downloads one, so unless you install a vec0 binary where SQLite can
        find it, every search runs against plain SQLite tables. That is
        correct, just slower at scale — see the backends section below.
      </Callout>

      <H2>Collections</H2>

      <P>
        A collection is a named set of vectors that all share one width. The
        first write to an unknown collection creates it at that width; a later
        vector of a different width throws instead of silently corrupting the
        ranking. Each collection is recorded in{" "}
        <Code>_yatta_vector_collections</Code>, so collections survive
        reopening the file.
      </P>

      <CodeBlock
        code={`// Create explicitly, or let the first upsert create it
db.vectors.ensureCollection("docs", 384);

// Paging, threshold, and stored vectors on request
db.vectors.search("docs", query, { limit: 10 });
db.vectors.search("docs", query, { threshold: 0.7 });
db.vectors.search("docs", query, { includeEmbedding: true });

// Reads and deletes
db.vectors.get("docs", "getting-started");
db.vectors.count("docs");
db.vectors.remove("docs", "getting-started");
db.vectors.listCollections();
db.vectors.dropCollection("docs");`}
      />

      <P>
        Vector writes inside <Code>db.transaction()</Code> commit or roll back
        with the surrounding work, like any other Yatta write. Search ranks by
        cosine similarity, not by insertion order. Equal scores tie-break by
        id, so ranking is deterministic.
      </P>

      <H3>Search options</H3>

      <Props
        items={[
          { name: "limit", desc: "Max hits to return. Defaults to 10." },
          { name: "threshold", desc: "Only return hits at or above this cosine similarity (-1 to 1)." },
          { name: "includeEmbedding", desc: "Also return each hit's stored embedding. Defaults to false." },
        ]}
      />

      <H2>Two backends, one API</H2>

      <P>
        Which engine stores a collection is decided lazily, on the first call
        that needs it, and recorded per collection:
      </P>

      <CodeBlock
        code={`// sqlite-vec: when a vec0 extension binary is installed where
// SQLite can find it, vectors live in a vec0 virtual table and
// search uses its nearest-neighbour index. The fast path at scale.

// sqlite: plain SQLite tables, and search is a brute-force cosine
// query built on json_each — every search scans the whole
// collection. Correct, no native binary needed, slower at scale.
// This is what runs when no vec0 binary is loadable.`}
      />

      <P>
        <Code>YATTA_VECTORS_BACKEND</Code> picks the mode:{" "}
        <Code>auto</Code> (default — try vec0, fall back to plain SQLite),{" "}
        <Code>sqlite-vec</Code> (refuse to run without vec0 rather than
        silently running slower), or <Code>sqlite</Code> (never attempt the
        extension). The value is a mode name, never a path: Yatta loads the
        extension only under the fixed name <Code>vec0</Code>, so no caller or
        environment value can steer it at an arbitrary file.{" "}
        <Code>db.vectors.backend</Code> reports what actually resolved (
        <Code>&quot;undecided&quot;</Code> before anything needed a decision).
      </P>

      <P>
        Scores agree across backends for the same data, up to float32 rounding
        in the vec0 table: the vec0 path stores a normalized copy for distance
        ranking and converts distance back to cosine. A collection created
        under one backend keeps that backend — a vec-backed collection opened
        where vec0 is missing throws plainly instead of returning wrong
        results, while a plain-SQLite collection stays readable and writable
        anywhere.
      </P>

      <Note>
        The plain-SQLite backend scans the whole collection per search.
        Measured on this VM (unit vectors, limit 10): about 85ms at 2,000 x
        128 dimensions, about 0.5s at 10,000 x 128, and about 2.5s at 10,000 x
        384 — against about 8ms for sqlite-vec at 10,000 x 384 with the same
        top hit. The SQL path is the honest choice without vec0 up to a few
        thousand vectors; past that, install vec0 and let{" "}
        <code>auto</code> pick it.
      </Note>

      <H2>Text embeddings</H2>

      <P>
        <Code>search()</Code> takes vectors you already have. For text, bring
        an embedder — any object with an <Code>embed(texts)</Code> function
        returning one vector per text — or use the optional local-model loader:
      </P>

      <CodeBlock
        code={`// Your own embedder, per call or as the store default
await db.vectors.upsertText("docs", { id: "gs", text: "Getting started" }, { embedder });
await db.vectors.searchText("docs", "how do I start", { embedder });
db.vectors.setEmbedder(embedder);
await db.vectors.searchText("docs", "how do I start");

// Or a locally run model, via the optional runtime (see below)
import { createLocalEmbedder } from "yatta.js/vectors/embed";
db.vectors.setEmbedder(await createLocalEmbedder());`}
      />

      <P>
        With no embedder and no model configured, text calls refuse plainly
        instead of inventing vectors. The local loader reads two environment
        variables and nothing else:
      </P>

      <Props
        items={[
          { name: "YATTA_EMBEDDING_MODEL", desc: "A plain model id such as \"vendor/small-embedding-model\". Path-like values (.., leading slash, backslash) are refused. The model is downloaded once and cached by the runtime; nothing downloads at startup or on any plain vector call." },
          { name: "YATTA_EMBEDDING_CACHE_DIR", desc: "Where the runtime caches the model. Optional; the runtime default applies when unset." },
        ]}
      />

      <P>
        The runtime package (<Code>@xenova/transformers</Code>) is optional
        and is not a Yatta dependency: without it,{" "}
        <Code>createLocalEmbedder()</Code> fails with install instructions
        instead of a bare import error. No model is bundled with Yatta, so
        pick a small one for your width — the width is whatever the model
        returns, and the collection is created at that width on first write.
      </P>

      <Callout>
        No real tiny-model end-to-end run was done: the local-model path is
        wired and throws plainly when the runtime or the model is missing, but
        no small model was actually downloaded and run through{" "}
        <code>createLocalEmbedder()</code> to a search. Treat it as
        unproven until you run it yourself.
      </Callout>

      <H2>Gotchas</H2>

      <P>
        <strong>Zero vectors have no cosine similarity</strong> and are
        refused at write and at query time. A query of all zeros is an error,
        not an empty result.
      </P>

      <P>
        <strong>
          <Code>threshold</Code> on the vec0 backend fetches the whole
          collection before filtering
        </strong>
        , because vec0 returns only its k nearest — a thresholded search over{" "}
        <Code>k = limit</Code> could drop qualifying rows past the cutoff.
        Without a threshold, <Code>k = limit</Code> is exactly what runs.
      </P>

      <P>
        <strong>The <Code>vec0</Code> binary is native code the operator
        installs and trusts</strong>, like any SQLite extension. Yatta
        verifies the loaded library answers <Code>vec_version()</Code> before
        trusting it as sqlite-vec.
      </P>

      <P>
        <strong>Image embeddings are deferred, deliberately:</strong> a vision
        model is a bigger download and a different pipeline, and this round
        ships text vectors done properly rather than both half done.{" "}
        <Code>search()</Code> already accepts any precomputed vector, so image
        vectors from your own pipeline work today — only the built-in image
        embedder is missing.
      </P>

      <P>
        <strong>The table name <Code>vectors</Code> is reserved</strong> on
        the database object (like other YattaDB methods), so a schema table
        cannot also be called <Code>vectors</Code>. Use{" "}
        <Code>db.table(&quot;vectors&quot;)</Code> explicitly if you truly
        need that name for a table.
      </P>

      <Note>
        In a compiled executable with <code>=strict</code>, files on disk are
        not part of the program, so the optional transformers package must be
        bundled into the executable to be loadable there.
      </Note>

      <DocFooter
        prev={{ href: "/docs/storage-tiering", title: "Storage tiering" }}
        next={{ href: "/docs/profiler", title: "Profiler" }}
      />
    </article>
  );
}
