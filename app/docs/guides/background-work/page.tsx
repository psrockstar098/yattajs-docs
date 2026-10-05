import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1, H2, P, Code, Note, DocFooter, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Send email from a job — YATTA Docs",
  description:
    "Keep slow work off the request path: enqueue a job, handle it in a worker, retry failures, and report progress.",
};


export default function BackgroundWorkGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Send email from a job" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="A request that sends email, calls an API, or generates a PDF makes the user wait for all of it — and fails them if any of it fails. Jobs fix both.">
        Send email from a job
      </H1>

      <H2 id="the-problem">The problem</H2>

      <CodeBlock
        title="the slow version"
        lang="ts"
        code={`api.post(async (ctx) => {
  const user = await createUser(ctx.json());      // fast

  await mailer.send({                             // slow, and can fail
    to: user.email,
    template: "welcome",
    data: { name: user.name, verifyUrl },
  });

  return API.json({ ok: true });                   // user waited for all of it
});`}
      />

      <P>
        Two failure modes: the user waits several seconds for an SMTP round trip,
        and if the mail server is down they get a <Code>500</Code> for something
        that actually succeeded.
      </P>

      <H2 id="register-the-handler">Register the handler</H2>

      <P>
        Handlers live in <Code>yatta/func/workers.ts</Code>, which{" "}
        <Code>yatta/main.ts</Code> imports at boot.
      </P>

      <CodeBlock
        title="yatta/func/workers.ts"
        code={`import { jobs } from "./jobs";
import { mailer } from "./mail";

jobs.handle("send-welcome", async ({ data, log }) => {
  log(\`sending welcome to \${data.to}\`);

  await mailer.send({
    to: data.to,
    subject: "Welcome to Yatta!",
    text: "Thanks for creating an account.",
  });

  return { sent: true };
});

export const defaultWorker = jobs.worker("default", {
  concurrency: 5,
  pollInterval: "1s",
  lockDuration: "60s",
});`}
      />

      <Note>
        <Code>concurrency</Code> is per worker process. Raising it above the
        database&apos;s comfortable write concurrency causes lock contention —
        start at 5 and raise deliberately.
      </Note>

      <H2 id="enqueue-from-a-route">Enqueue from a route</H2>

      <CodeBlock
        title="yatta/backend/signup.ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { db } from "../func/db";
import { jobs } from "../func/jobs";

const api = createAPI();

api.post(async (ctx) => {
  const { email, name } = await ctx.json();

  const user = db.users.insert({ email, name });

  // Returns immediately; the worker does the rest.
  await jobs.enqueue("send-welcome", {
    to: user.email,
    name: user.name,
  });

  return API.json({ ok: true, user: user.id }, { status: 201 });
});

export default api;`}
      />

      <H2 id="event-driven">Event-driven instead</H2>

      <P>
        If the same thing should happen in several places, pipe an event into
        the queue rather than enqueueing from each one.
      </P>

      <CodeBlock
        title="yatta/func/events.ts"
        code={`events.on("user.registered", (data) => {
  console.log(\`new user: \${data.email}\`);
});

// Event payload → job payload.
events.pipe(
  "user.registered",
  "send-welcome",
  undefined,
  (data) => ({ to: data.email, name: data.name }),
);

// Emit from anywhere.
await events.emit("user.registered", {
  userId: user.id,
  email: user.email,
  name: user.name,
});`}
      />

      <H2 id="failures">Failures and retries</H2>

      <P>
        A throwing handler is retried with exponential backoff and jitter. After
        the attempt limit the job moves to the dead-letter queue.
      </P>

      <CodeBlock
        title="control the policy"
        code={`await jobs.enqueue("send-welcome", data, {
  attempts: 5,
  timeout: "30s",
  retry: {
    type: "exponential",
    delay: 2000,
    factor: 2,
    jitter: true,     // spreads retries out
    maxDelay: "10m",
  },
});`}
      />

      <CodeBlock
        title="inspect failures"
        code={`const dead = await jobs.dlq.list("default");

// Send one back through the queue after fixing the cause.
await jobs.dlq.retry(dead[0].id);

// Or clear them out.
await jobs.dlq.purge("default");

const stats = await jobs.metrics("default");
// { queued, delayed, running, completed, dead }`}
      />

      <Note kind="warn">
        Do not retry a permanent failure. If the address is invalid, retrying
        three times just delays the inevitable — validate before enqueueing.
      </Note>

      <H2 id="progress">Progress reporting</H2>

      <P>
        Long jobs can report progress, which is also how you broadcast state to
        the browser over the realtime connection.
      </P>

      <CodeBlock
        title="progress"
        code={`jobs.handle("generate-report", async (ctx) => {
  await ctx.progress(10, "Fetching rows");

  const rows = await fetchAllRows();

  await ctx.progress(50, "Rendering PDF");

  const pdf = await render(rows);

  await ctx.progress(100, "Done");

  // Bail out if the job was cancelled or timed out.
  if (ctx.signal.aborted) return;

  return { url: upload(pdf) };
});`}
      />

      <CodeBlock
        title="broadcast it live"
        code={`import { realtime } from "./func/realtime";

// Inside the handler
realtime.job(ctx.id).progress(50, "Rendering");

// In the browser
const tracker = realtime.job(jobId);
tracker.on("progress", (p) => {
  bar.style.width = \`\${p.percent}%\`;
});`}
      />

      <H2 id="scheduled-work">Scheduled work</H2>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`cron.schedule("nightly-cleanup", "0 0 * * *", async () => {
  await jobs.enqueue("cleanup-stale-tokens");
});

cron.every("10m", () => {
  console.log("[cron] heartbeat");
});`}
      />

      <DocFooter
        prev={{ href: "/docs/guides/uploads", title: "Upload files" }}
        next={{ href: "/docs/guides/production", title: "Go to production" }}
      />
    </article>
  );
}
