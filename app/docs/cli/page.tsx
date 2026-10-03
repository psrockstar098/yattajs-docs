import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  P,
  UL,
  LI,
  Note,
  DocFooter,
  Code,
  Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Install & CLI — YATTA Docs",
  description:
    "Install Yatta, scaffold a project with yatta init, and use the CLI to link a local checkout while you develop.",
};

export default function CliDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Getting started" },
          { label: "Install & CLI" },
        ]}
      />
      <H1
        eyebrow="Getting started"
        sub="One install and one command give you a working backend: a server entrypoint, a file router, and every engine wired together."
      >
        Install &amp; CLI
      </H1>

      <H2>Install</H2>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`bun add yatta

# or
npm install yatta`}
      />

      <P>Then scaffold the <Code>yatta/</Code> folder:</P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`yatta init
bun run dev`}
      />

      <H2>Commands</H2>

      <CodeBlock
        title="yatta --help"
        lang="text"
        code={`yatta init          Create yatta/ in the current project
yatta new <name>    Scaffold a brand-new project directory
yatta link          Register this checkout in Bun's global link registry
yatta unlink        Remove it again
yatta dev           Run the server in watch mode
yatta start         Run the server
yatta cluster       Run one process per core
yatta check         Typecheck, then run tests
yatta build         Bundle the worker runtime to dist/
yatta info          Show versions, paths, and import specifiers`}
      />

      <H2>yatta init</H2>

      <P>
        Safe to run in a project that already exists. It creates the{" "}
        <Code>yatta/</Code> folder, adds <Code>yatta</Code> to your
        dependencies, and points <Code>dev</Code> and <Code>start</Code> at{" "}
        <Code>yatta/main.ts</Code>.
      </P>

      <CodeBlock
        title="what it does"
        lang="text"
        code={`✓ Created:
    yatta/main.ts            server entrypoint
    yatta/backend/index.ts   GET /
    yatta/func/
      db.ts            ORM + schema
      auth.ts          auth, passkeys, 2FA
      cache.ts         L1 LRU + SQLite L2
      mail.ts          templates + transports
      storage.ts       local + S3 disks
      jobs.ts          durable queue
      events.ts        typed event bus
      cron.ts          scheduled tasks
      workers.ts       job handlers + pool
      realtime.ts      WebSocket + SSE
      routerHelper.ts  route dispatch

✓ "dev" script → bun --watch yatta/main.ts
✓ "start" script → bun yatta/main.ts
✓ Added "yatta" to dependencies
✓ "module" → yatta/main.ts
✓ Patched tsconfig.json`}
      />

      <H2>It will not overwrite your work</H2>

      <P>Two safeguards:</P>

      <UL>
        <LI>
          If <Code>yatta/main.ts</Code> already exists, init stops and changes
          nothing
        </LI>
        <LI>
          An existing <Code>dev</Code> script that you wrote yourself is left
          alone — you are told to add Yatta alongside it
        </LI>
      </UL>

      <CodeBlock
        title="preserved"
        lang="json"
        code={`// before
{ "scripts": { "dev": "vite --port 5173", "build": "vite build" } }

// after yatta init
{ "scripts": {
    "dev": "vite --port 5173",     ← untouched
    "build": "vite build",         ← untouched
    "start": "bun yatta/main.ts"   ← added
} }`}
      />

      <H2>Working on Yatta itself</H2>

      <P>
        If you are changing the framework, link your checkout instead of
        installing from npm. Edits then appear in your project immediately.
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`# once, from the framework checkout
cd /path/to/yatta
yatta link

# in each project that uses it
cd my-api
bun link yatta`}
      />

      <Note>
        <Code>yatta link</Code> makes the checkout available;{" "}
        <Code>bun link yatta</Code> connects a project to it. The first is run
        once, the second in every project.
      </Note>

      <H2>Project layout</H2>

      <P>
        Only the <Code>yatta/</Code> folder is yours to edit.{" "}
        <Code>package.json</Code> and <Code>tsconfig.json</Code> stay at the
        project root, where they belong to the project.
      </P>

      <CodeBlock
        title="tree"
        lang="text"
        code={`my-api/
├── package.json        ← your project
├── tsconfig.json
└── yatta/
    ├── main.ts         ← server, subsystem wiring
    ├── backend/        ← your routes
    └── func/           ← your engine config and schema`}
      />

      <H2>Global install</H2>

      <P>
        To run <Code>yatta</Code> from anywhere, put the CLI on your{" "}
        <Code>PATH</Code>:
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`ln -sf /path/to/yatta/src/cli.ts ~/.bun/bin/yatta`}
      />

      <DocFooter
        prev={{ href: "/docs", title: "Introduction" }}
        next={{ href: "/docs/layout", title: "Project layout" }}
      />
    </article>
  );
}
