import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, Props, Code } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Introduction — YATTA Docs",
  description:
    "Yatta is a backend framework for Bun: a hardware-aware worker runtime plus eight engines you can adopt one at a time.",
};

export default function DocsIntroPage() {
  return (
    <article className="max-w-3xl">
      <H1 eyebrow={'Getting started'} sub="A backend framework for Bun. One install replaces the database, auth, queue, cache, storage, mail and realtime services you would otherwise assemble and operate yourself.">
        Introduction
      </H1>

      <P>
        Most Bun backends are a thin HTTP layer. Yatta is the part underneath
        it as well: a worker scheduler that keeps CPU work off your event loop,
        and a set of engines that run in-process, sharing one database and one
        type registry.
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`# 1. Install
bun add yatta.js

# 2. Create yatta/ in the current project
yatta init

# 3. Run
bun run dev`}
      />

      <P>
        That is the whole setup. <Code>yatta init</Code> writes a{" "}
        <Code>yatta/</Code> folder containing a server entrypoint, a backend
        router, and one file per engine — all wired together and ready to
        edit. See <Link href="/docs/cli" className="underline underline-offset-4">Install &amp; CLI</Link>.
      </P>

      <H2>What you get</H2>

      <P>Eight engines, each importable on its own:</P>

      <UL>
        <LI>
          <Code>Database</Code> — typed SQLite ORM with relations, transactions
          and migrations
        </LI>
        <LI>
          <Code>Auth</Code> — Argon2id passwords, sessions, passkeys, 2FA, API keys
        </LI>
        <LI>
          <Code>Jobs</Code> — durable queues, cron, and a typed event bus
        </LI>
        <LI>
          <Code>Cache</Code> — in-memory LRU backed by SQLite
        </LI>
        <LI>
          <Code>Storage</Code> — local disk and S3 with signed URLs
        </LI>
        <LI>
          <Code>Mail</Code> — templates, layouts, and seven transports
        </LI>
        <LI>
          <Code>Realtime</Code> — WebSockets and SSE in one interface
        </LI>
        <LI>
          <Code>API</Code> — file-based routing and middleware
        </LI>
      </UL>

      <H2>How it fits together</H2>

      <P>
        The <Link href="/docs/runtime" className="underline underline-offset-4">runtime</Link>{" "}
        splits work across two pools. Anything marked <Code>io</Code> runs
        concurrently; anything marked <Code>cpu</Code> runs one task at a time
        on a dedicated thread. Password hashing and crypto never block a
        request.
      </P>

      <CodeBlock
        title="yatta/main.ts"
        code={`import { createRuntime, defineSubsystem } from "yatta.js/runtime";
import routers from "./func/routerHelper";

const runtime = createRuntime({ taskTimeoutMs: 30_000 });
await runtime.start();

// CPU work is serialized; I/O work runs concurrently.
await runtime.registerSubsystem(
  defineSubsystem({
    name: "auth",
    entrypoint: new URL("./func/auth.ts", import.meta.url),
    workload: "cpu",
  }),
);

Bun.serve({
  port: Number(process.env.PORT) || 4000,
  fetch: (req, server) => routers(req, server),
});`}
      />

      <H2>Your first route</H2>

      <P>
        Routes are files. Anything in <Code>yatta/backend/</Code> is matched
        with a Next.js-style convention:
      </P>

      <CodeBlock
        title="yatta/backend/user/index.ts"
        code={`import { API, createAPI } from "yatta.js/api";

const api = createAPI();

api.get(async (ctx) => {
  return API.json({ id: ctx.params.id });
});

export default api;`}
      />

      <P>
        <Code>yatta/backend/user/index.ts</Code> serves <Code>/user</Code>, and{" "}
        <Code>ctx.params.id</Code> is typed from the filename. See{" "}
        <Link href="/docs/api" className="underline underline-offset-4">HTTP API</Link>.
      </P>

      <H2>One route, both sides</H2>

      <P>
        Write a route once and the browser gets a typed call from it. The same
        table makes the endpoint and the client method, so there is no second copy
        of your types to fall out of date.
      </P>

      <CodeBlock
        title="api-contract.ts"
        code={`import { z } from "zod";
import { route } from "yatta.js/rpc";

export const routes = {
  getUser: route({
    method: "get",
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    response: z.object({ id: z.string(), email: z.string(), name: z.string() }),
  }),
};`}
      />

      <P>
        The server serves that table; the browser calls it with{" "}
        <Code>clientFor(routes, &#123; baseUrl: &quot;/api&quot; &#125;)</Code> and{" "}
        <Code>user.email</Code> is a string. See{" "}
        <Link href="/docs/client" className="underline underline-offset-4">
          Typed client
        </Link>
        .
      </P>

      <H2>Typed keys</H2>

      <P>
        Engine keys are typed through declaration merging. Add your job names
        once and every call site gets autocompletion and payload checking — with
        no code generation step.
      </P>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs, SQLiteJobStore } from "yatta.js/jobs";

export interface AppJobs {
  "send-email": { to: string; subject: string; body: string };
}

declare module "yatta.js/jobs" {
  interface JobRegister extends AppJobs {}
}

export const jobs = createJobs({
  store: new SQLiteJobStore("Database/jobs.db"),
});`}
      />

      <P>
        <Code>{"jobs.enqueue(\"send-email\")"}</Code> is now checked against that shape.
        Full guide in{" "}
        <Link href="/docs/types" className="underline underline-offset-4">Typed keys</Link>.
      </P>

      <H2>Configuration</H2>

      <Props
        items={[
          {
            name: "PORT",
            type: "number",
            desc: "Defaults to 4000.",
          },
          {
            name: "NODE_ENV",
            type: '"production" | "development" | "test"',
            desc: "Defaults to development.",
          },
          {
            name: "STORAGE_SECRET",
            type: "string",
            desc: (
              <>
                Signs storage URLs. <strong className="text-[#f3eed7]/70">Required in production</strong>; outside it a
                temporary secret is generated and a warning is logged.
              </>
            ),
          },
          {
            name: "DATABASE_URL",
            type: "string",
            desc: "SQLite file path. Defaults to Database/app.db.",
          },
        ]}
      />

      <Note>
        Configuration is validated before anything boots. A malformed{" "}
        <Code>PORT</Code> or a missing production secret stops the process
        immediately instead of failing halfway. See{" "}
        <Link href="/docs/config" className="underline underline-offset-4">Configuration</Link>.
      </Note>

      <H2>Where to next</H2>

      <UL>
        <LI>
          <Link href="/docs/layout" className="underline underline-offset-4">
            Project layout
          </Link>{" "}
          — what each generated file does
        </LI>
        <LI>
          <Link href="/docs/db" className="underline underline-offset-4">
            Database
          </Link>{" "}
          — the ORM most projects start with
        </LI>
        <LI>
          <Link href="/docs/auth" className="underline underline-offset-4">
            Authentication
          </Link>{" "}
          — users, sessions and passkeys
        </LI>
        <LI>
          <Link href="/docs/reliability" className="underline underline-offset-4">
            Reliability
          </Link>{" "}
          — supervision, deadlines, draining
        </LI>
      </UL>
    </article>
  );
}
