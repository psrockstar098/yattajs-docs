import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
  UL,
  LI,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Quickstart — YATTA Docs",
  description:
    "Scaffold a Yatta project, start the runtime, and serve your first route in about two minutes.",
};

export default function QuickstartPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Getting started" },
          { label: "Quickstart" },
        ]}
      />

      <H1
        eyebrow="Getting started"
        sub="Scaffold a project, start the worker runtime, and serve your first route. Two minutes, no configuration files."
      >
        Quickstart
      </H1>

      <H2 id="scaffold">Scaffold a project</H2>

      <P>
        The CLI writes a complete project: <code>yatta/main.ts</code>, the{" "}
        <code>yatta/backend/</code> and <code>yatta/func/</code> directories, and
        every subsystem already wired to its own worker pool. It prints the install
        and link commands you still need rather than reaching for the network
        without being asked.
      </P>

      <CodeBlock
        title="terminal"
        code={`bunx yatta new my-app
cd my-app
bun run dev`}
      />

      <P>
        You should see the runtime mount all eight subsystems and bind a port:
      </P>

      <CodeBlock
        code={`[Yatta Runtime] Fleet active on 2 CPU cores:
  • CPU-Bound Workers : 1
  • I/O-Bound Workers : 2 (smol: true)
  • Total OS Threads  : 3
✓ Yatta listening on http://localhost:4000
  routes:  yatta/backend/
  modules: yatta/func/
  observe:  http://localhost:4000/_yatta/dashboard`}
      />

      <Callout kind="note">
        The port is <code>4000</code> by default. Set <code>PORT</code> to change
        it — see <a href="/docs/config" className="underline underline-offset-4">Configuration</a>.
      </Callout>

      <H2 id="first-route">Write your first route</H2>

      <P>
        Routes are files. Drop one in <code>yatta/backend/</code> and it is
        served on the next request — there is no router to register it with.
      </P>

      <CodeBlock
        title="yatta/backend/hello.ts"
        code={`import { createAPI } from "yatta.js/api";

const hello = createAPI("/hello");

hello.get((ctx) => {
  return Response.json({ message: "Hello from Yatta" });
});

export default hello;`}
      />

      <CodeBlock
        title="terminal"
        code={`$ curl http://localhost:4000/hello
{"message":"Hello from Yatta"}`}
      />

      <P>
        The path passed to <code>createAPI</code> is typed, so{" "}
        <code>ctx.params</code> is inferred from the literal rather than
        declared by hand.
      </P>

      <H2 id="add-data">Add data</H2>

      <P>
        Declare a schema and the ORM builds the tables on boot. There is no
        migration file to write for a new schema.
      </P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta.js/db";

export const schema = {
  notes: {
    id: col.uuid(),
    title: col.text(),
    body: col.text().nullable(),
    createdAt: col.createdAt(),
  },
};

export const db = createDatabase({
  url: process.env.DATABASE_URL,
  schema,
});`}
      />

      <CodeBlock
        title="yatta/backend/notes.ts"
        code={`import { createAPI } from "yatta.js/api";
import { db } from "../func/db";

const notes = createAPI("/notes");

// Tables are properties on the handle: db.notes, not a select().from().
notes.get(async () => {
  const rows = await db.notes
    .where((f) => f.archived.isEqualTo(false))
    .orderBy({ createdAt: "desc" })
    .limit(50)
    .all();

  return Response.json(rows);
});

notes.post(async (ctx) => {
  const body = await ctx.json();
  const note = await db.notes.insert(body);
  return Response.json(note, { status: 201 });
});

export default notes;`}
      />

      <H2 id="background-work">Move slow work off the request</H2>

      <P>
        Anything slow — sending mail, calling a third-party API, generating a
        report — belongs on a job. The handler runs on a worker, so the request
        returns as soon as the job is queued.
      </P>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs } from "yatta.js/jobs";

export const jobs = createJobs();

export interface JobHandlers {
  "send-welcome": { to: string };
}

jobs.handle("send-welcome", async ({ to }) => {
  await mail.send({ to, subject: "Welcome", template: "welcome" });
});`}
      />

      <CodeBlock
        code={`await jobs.enqueue("send-welcome", { to: user.email });`}
      />

      <H2 id="check">Check the build</H2>

      <P>
        <code>yatta check</code> runs the same validation in CI — TypeScript
        across the project, plus a boot of the runtime to prove the schema
        applies cleanly.
      </P>

      <CodeBlock
        title="terminal"
        code={`bun run yatta check`}
      />

      <Callout kind="tip">
        Run <code>yatta check</code> before every deploy. It catches the two
        failures that are otherwise only visible in production: a schema that
        will not apply, and a worker that cannot mount.
      </Callout>

      <H2 id="commands">Every command</H2>

      <UL>
        <LI>
          <code>yatta new &lt;name&gt;</code> — scaffold a project.{" "}
          <code>yatta new .</code> scaffolds into the current directory.
        </LI>
        <LI>
          <code>yatta dev</code> — start with hot reload.
        </LI>
        <LI>
          <code>yatta start</code> — start in production mode.
        </LI>
        <LI>
          <code>yatta cluster</code> — spawn one worker process per core, bound
          to the same port with <code>SO_REUSEPORT</code>.
        </LI>
        <LI>
          <code>yatta check</code> — typecheck and boot-verify.
        </LI>
        <LI>
          <code>yatta info</code> — print the resolved environment and topology.
        </LI>
        <LI>
          <code>yatta link</code> / <code>yatta unlink</code> — manage the global
          link to the framework itself.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs", title: "Introduction" }}
        next={{ href: "/docs/cli", title: "Install & CLI" }}
      />
    </article>
  );
}
