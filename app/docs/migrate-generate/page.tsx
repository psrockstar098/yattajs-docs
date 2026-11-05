import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Auto-migrations — YATTA Docs",
  description:
    "migrate:generate reads the live SQLite schema, compares it against the TypeScript models, and writes a real migration file.",
};

export default function MigrateGenerateDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Auto-migrations" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="migrate:make writes a blank template you fill in by hand; migrate:generate closes that gap by writing the migration from the difference between your models and the live database.">
        Auto-migrations
      </H1>

      <P>
        <Code>migrate:generate</Code> reads the live SQLite schema, compares
        it against the TypeScript models, and writes a real migration file in
        the same format (<Code>name</Code>, <Code>up</Code>,{" "}
        <Code>down</Code>) into <Code>./migrations/</Code>.
      </P>

      <H2>Running it</H2>

      <CodeBlock
        title="Generate from model changes"
        code={`# Compare the live database against the models in db.ts
yatta migrate:generate --schema db.ts

# Name the migration, preview without writing, allow destructive changes
yatta migrate:generate --schema db.ts --name add_bio --dry-run
yatta migrate:generate --schema db.ts --allow-destructive`}
      />

      <Props
        items={[
          { name: "--schema <path>", desc: "Models file to diff against. Without it, the command tries db.ts, yatta/db.ts, src/db.ts, database.ts, and yatta/database.ts, in that order." },
          { name: "--name <name>", desc: "Migration name. Default is auto_generated. The file is named <timestamp>_<name>.ts." },
          { name: "--dry-run", desc: "Print the up statements without writing a file." },
          { name: "--allow-destructive", desc: "Write the file even when it deletes data. --yes is accepted as an alias. Without it, destructive changes need an interactive yes on a terminal, or the command refuses with exit code 1." },
        ]}
      />

      <P>
        The live database is found the same way the server finds it:{" "}
        <Code>DATABASE_URL</Code> first, then <Code>DATABASE_PATH</Code>,
        then <Code>Database/yatta.db</Code> in the project root.
      </P>

      <H2>How it finds the models</H2>

      <P>
        The schema file must export a <Code>schema</Code> object of{" "}
        <Code>col.*</Code> builders — the same object passed to{" "}
        <Code>createDatabase</Code>.
      </P>

      <CodeBlock
        title="db.ts — models only, no server boot"
        code={`import { col } from "yatta.js/db";

export const schema = {
  users: {
    id: col.id(),
    email: col.text().unique(),
    bio: col.text().nullable(),
  },
};`}
      />

      <Callout kind="warn">
        A schema file that boots the server hides the diff. If the imported
        file calls <Code>createDatabase</Code>, boot sync applies the
        additive changes before the diff runs. Point{" "}
        <Code>--schema</Code> at a models-only module when you want a diff
        against the live database.
      </Callout>

      <H2>What it generates</H2>

      <P>
        New tables become <Code>CREATE TABLE</Code>, new columns become{" "}
        <Code>ALTER TABLE ... ADD COLUMN</Code>, new indexes become{" "}
        <Code>CREATE INDEX</Code> (unique columns get{" "}
        <Code>CREATE UNIQUE INDEX</Code>). Down migrations reverse each
        step: new tables are dropped, added columns are dropped, added
        indexes are dropped.
      </P>

      <CodeBlock
        title="20261105030000_add_bio.ts (generated)"
        code={`export default {
  name: "20261105030000_add_bio",

  up(db: any) {
    db.run(\`ALTER TABLE "users" ADD COLUMN "bio" TEXT;\`);
  },

  down(db: any) {
    db.run(\`ALTER TABLE "users" DROP COLUMN "bio";\`);
  },
};`}
      />

      <H2>Changed columns go through a rebuild</H2>

      <P>
        Changed column definitions cannot be altered in place in SQLite, so
        they go through a table rebuild: a new table is built from the
        models, the shared columns are copied over, and the old table is
        swapped out. No rows are lost — the rebuild copies them.
      </P>

      <P>
        Rebuild migrations are <Code>async</Code> on purpose — the runner
        wraps a synchronous <Code>up</Code> in a transaction, and SQLite
        ignores <Code>PRAGMA foreign_keys = OFF</Code> inside one. An async{" "}
        <Code>up</Code> runs outside that transaction, so it can switch
        foreign keys off, run its own transaction, and switch them back on.
        A failure rolls back and leaves no applied marker, so re-running is
        safe.
      </P>

      <H2>Destructive changes</H2>

      <P>
        Column drops, table drops, and type or primary-key changes are
        destructive and are never written silently. The command lists them,
        refuses with exit code 1, and only writes the file with{" "}
        <Code>--allow-destructive</Code> (or an interactive{" "}
        <Code>yes</Code> on a terminal). A drop beside a same-type new column
        is flagged as a possible rename — the generator never renames
        automatically, because a guessed rename destroys a column.
      </P>

      <P>
        Dropped data cannot be restored by <Code>down</Code>: a down
        migration recreates the dropped table or column empty. The generated
        file header says so.
      </P>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>No diff, no file.</strong> When the live database already
          matches the models, the command says so and exits cleanly without
          writing anything. The same applies when no live database exists
          yet — start the server or run <Code>yatta migrate</Code> once to
          create it, then generate.
        </LI>
        <LI>
          <strong>A new NOT NULL column without a default cannot be
          generated</strong> for a table that already has rows — there is no
          value the generator could honestly invent. Give the column{" "}
          <Code>.default(...)</Code> or <Code>.nullable()</Code> first. The
          same refusal applies to a new primary-key column without
          auto-increment.
        </LI>
        <LI>
          <strong>Indexes in the database but not in the models are left
          alone.</strong> Dropping a hand-made index the models never
          mentioned would be a silent performance regression, not a schema
          fix.
        </LI>
        <LI>
          <strong>NOT NULL tightening fails on apply if rows hold
          NULL.</strong> The rebuild copies rows verbatim, so clean those
          rows first; the generated file calls this out in its header.
        </LI>
        <LI>
          <strong>Down for a dropped NOT NULL column without a
          default</strong> cannot use <Code>ADD COLUMN</Code> (SQLite
          refuses it). The generated <Code>down</Code> carries a note
          instead of a statement — rebuild the table from its previous
          definition to roll that one back.
        </LI>
      </UL>

      <Note>
        Two generates in the same second share a timestamp, so the second
        file gets a suffix rather than overwriting the first. Review every
        generated file before running <Code>yatta migrate</Code> — the
        header lists each change, destructive ones marked.
      </Note>

      <DocFooter
        prev={{ href: "/docs/cache-decorator", title: "Cache decorator & edge purge" }}
        next={{ href: "/docs/outbox", title: "Transactional outbox" }}
      />
    </article>
  );
}
