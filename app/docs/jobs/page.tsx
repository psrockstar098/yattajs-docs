import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1, H2, P, UL, LI, Code, DocFooter, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Job queue — YATTA Docs",
  description:
    "Durable background work: leases, retries, dead-letter handling, priority queues, cron scheduling, and progress reporting.",
};

export default function JobsDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Job queue" },
        ]}
      />
      <H1 eyebrow="Engines" sub="Work that must not block a request: email, exports, cleanup. Jobs persist in SQLite with leases, retries and a dead-letter queue. Events can pipe straight into a job.">
        Job queue
      </H1>

      <H2>Setup</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs, SQLiteJobStore } from "yatta.js/jobs";

export interface AppJobs {
  "send-email": { to: string; subject: string; body: string };
  "cleanup-stale-tokens": { maxAgeDays?: number };
}

declare module "yatta.js/jobs" {
  interface JobRegister extends AppJobs {}
}

export const jobs = createJobs({
  store: new SQLiteJobStore("Database/jobs.db"),
});`}
      />

      <H2>Handlers</H2>

      <P>
        Handlers run in a worker pool, isolated from the HTTP event loop.
        Register them once, in a file that is imported at boot.
      </P>

      <CodeBlock
        title="yatta/func/workers.ts"
        code={`import { jobs } from "./jobs";
import { mailer } from "./mail";

jobs.handle("send-email", async ({ data }) => {
  await mailer.send({
    to: data.to,
    subject: data.subject,
    text: data.body,
  });
});

jobs.handle("cleanup-stale-tokens", async ({ data, log }) => {
  log(\`Cleaning tokens older than \${data.maxAgeDays ?? 7} days\`);
});

// Start the pool
export const defaultWorker = jobs.worker("default", {
  concurrency: 5,
  pollInterval: "1s",
  lockDuration: "60s",
});`}
      />

      <H2>Enqueuing</H2>

      <CodeBlock
        title="Two styles"
        code={`// Direct
await jobs.enqueue("send-email", {
  to: "ada@example.com",
  subject: "Welcome",
  body: "Hello there",
});

// Fluent, when you need options
await jobs
  .job("send-email")
  .with({ to: user.email, subject: "Welcome", body: "Hello" })
  .delay("10m")
  .priority("high")
  .unique(\`welcome:\${user.id}\`)
  .save();`}
      />

      <H2>Options</H2>

      <CodeBlock
        title="EnqueueOptions"
        code={`{
  queue: "default",        // target queue
  delay: "5m",             // wait before running
  runAt: Date,             // or an exact time
  attempts: 3,             // then the DLQ
  priority: "high",        // low | normal | high | critical
  timeout: "30s",          // abort a runaway handler
  uniqueKey: "welcome:42", // dedupe while active
  retry: {
    type: "exponential",   // or "fixed"
    delay: 1000,
    factor: 2,
    jitter: true,
    maxDelay: "1h",
  },
}`}
      />

      <H2>Retries and the dead-letter queue</H2>

      <P>
        A failing handler is retried with exponential backoff and jitter. After
        the attempt limit it moves to the DLQ, where it can be inspected and
        replayed.
      </P>

      <CodeBlock
        title="DLQ"
        code={`const dead = await jobs.dlq.list("default");
await jobs.dlq.retry(deadJob.id);   // back on the queue
await jobs.dlq.purge("default");    // discard

const stats = await jobs.metrics("default");
// { queued, delayed, running, completed, dead }`}
      />

      <H2>Cron</H2>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`import { createCron } from "yatta.js/jobs";
import { jobs } from "./jobs";

export const cron = createCron();

// Standard 5-field Vixie syntax.
cron.schedule("nightly-cleanup", "0 0 * * *", async () => {
  await jobs.enqueue("cleanup-stale-tokens");
});

// Shorthand for plain intervals.
cron.every("10m", () => {
  console.log("[cron] heartbeat");
});`}
      />

      <UL>
        <LI>
          <Code>*</Code> every value, <Code>5</Code> specific,{" "}
          <Code>*/2</Code> every two, <Code>1-5</Code> range,{" "}
          <Code>1,5</Code> list
        </LI>
        <LI>Field order: minute, hour, day-of-month, month, day-of-week</LI>
        <LI>Timezone-aware schedules via <Code>Intl.DateTimeFormat</Code></LI>
      </UL>

      <H2>Scheduled work</H2>

      <P>
        A schedule is just a way to enqueue a job on a timer — the handler and
        its retry policy are the same as any other job.
      </P>

      <DocFooter
        prev={{ href: "/docs/auth", title: "Authentication" }}
        next={{ href: "/docs/events", title: "Events" }}
      />
    </article>
  );
}

