import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Project layout — YATTA Docs",
  description:
    "What yatta init generates, what each file does, and which files you are meant to edit.",
};

export default function LayoutDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Getting started" },
          { label: "Project layout" },
        ]}
      />
      <H1 eyebrow={'Getting started'} sub="One folder holds everything Yatta-related. Nothing is hidden from you, and nothing outside it is generated for you.">
        Project layout
      </H1>

      <CodeBlock
        title="after yatta init"
        lang="text"
        code={`my-api/
├── package.json
├── tsconfig.json
│
└── yatta/
    ├── main.ts
    ├── backend/
    │   ├── _router.ts
    │   └── index.ts
    └── func/
        ├── db.ts
        ├── auth.ts
        ├── cache.ts
        ├── mail.ts
        ├── storage.ts
        ├── jobs.ts
        ├── events.ts
        ├── cron.ts
        ├── workers.ts
        ├── realtime.ts
        ├── peer.ts
        └── routerHelper.ts`}
      />

      <H2>main.ts</H2>

      <P>
        The entrypoint. <Code>bun run dev</Code> starts here. It boots the
        runtime, mounts each subsystem, and serves HTTP.
      </P>

      <CodeBlock
        title="yatta/main.ts"
        code={`const runtime = createRuntime({ taskTimeoutMs: 30_000 });
await runtime.start();

const subsystems = [
  defineSubsystem({ name: "auth", entrypoint: ..., workload: "cpu" }),
  defineSubsystem({ name: "jobs", entrypoint: ..., workload: "cpu" }),
  defineSubsystem({ name: "db",   entrypoint: ..., workload: "io" }),
  // …
];

for (const subsystem of subsystems) {
  await runtime.registerSubsystem(subsystem);
}

const server = Bun.serve({ port, fetch, websocket: realtime.websocket });`}
      />

      <H2>backend/ — your routes</H2>

      <P>
        This is where most of your code goes. Files map to paths; anything
        without a matching file is a 404.
      </P>

      <CodeBlock
        title="convention"
        lang="text"
        code={`backend/index.ts            →  /
backend/user/index.ts       →  /user
backend/posts/[id].ts       →  /posts/:id
backend/users/[id]/posts.ts →  /users/:id/posts`}
      />

      <Note>
        <Code>_router.ts</Code> is infrastructure — you can leave it alone. It
        handles matching, trailing-slash fallback, security headers and the
        <Code>/storage</Code> and <Code>/realtime</Code> routes.
      </Note>

      <H2>func/ — one file per engine</H2>

      <P>
        Each file configures one engine. These are meant to be edited: the
        schema, the disk list, the job names, the mail templates.
      </P>

      <CodeBlock
        title="what to edit where"
        lang="text"
        code={`func/db.ts          schema — your tables
func/auth.ts        auth config + the SQLite auth store
func/cache.ts       cache sizing and TTL
func/mail.ts        templates and layouts
func/storage.ts     disks: local, s3
func/jobs.ts        job names (AppJobs)
func/events.ts      event names (AppEvents)
func/cron.ts        schedules
func/workers.ts     job handlers
func/realtime.ts    WebSocket/SSE handlers
func/peer.ts        client address, for per-IP rate limits
func/routerHelper.ts  routing infra`}
      />

      <P>
        All of them are mounted as subsystems, so each runs on its own worker
        thread. <Code>auth.ts</Code> and <Code>jobs.ts</Code> sit on the CPU pool;
        the rest are I/O.
      </P>

      <H2>Where things are stored</H2>

      <CodeBlock
        title="runtime data"
        lang="text"
        code={`Database/
  app.db       ← schema + users + sessions
  cache.db     ← L2 cache
  jobs.db      ← queue, leases, dead letters

storage/
  uploads/     ← local disk driver`}
      />

      <Note>
        Both directories are created on first boot and are disposable. In
        production, mount them as volumes — or point storage at S3 and keep only
        the database.
      </Note>

      <H2>Adding things</H2>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">A route</strong> — drop a file
          into <Code>backend/</Code>, then restart (new files need a restart;
          edits hot-reload)
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">A table</strong> — add it to the{" "}
          <Code>schema</Code> in <Code>func/db.ts</Code>; it is created on the
          next boot
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">A job</strong> — add the name to{" "}
          <Code>AppJobs</Code>, register a handler in <Code>workers.ts</Code>
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">A subsystem</strong> — add the
          file, then register it in <Code>main.ts</Code>
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/cli", title: "Install & CLI" }}
        next={{ href: "/docs/runtime", title: "Worker runtime" }}
      />
    </article>
  );
}
