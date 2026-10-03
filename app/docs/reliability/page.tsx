import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Reliability — YATTA Docs",
  description:
    "Crash supervision, task execution deadlines, and graceful draining: what happens when a worker dies, a task hangs, or the process is asked to stop.",
};

export default function ReliabilityDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "The runtime" },
          { label: "Reliability" },
        ]}
      />
      <H1 eyebrow={'The runtime'} sub="Three failure modes that normally end in a hung request or a dead thread: a worker that dies, a task that never returns, and a process that is asked to stop.">
        Reliability
      </H1>

      <H2>Worker supervision</H2>

      <P>
        When a worker emits <Code>error</Code> or <Code>close</Code>, the
        scheduler does three things:
      </P>

      <UL>
        <LI>
          Rejects every in-flight request and every queued task with{" "}
          <Code>WorkerCrashError</Code> — so callers fail fast instead of
          hanging forever
        </LI>
        <LI>Spawns a replacement worker with an identical configuration</LI>
        <LI>
          Re-mounts every subsystem graph the dead worker was hosting, then
          re-points routing at the replacement
        </LI>
      </UL>

      <CodeBlock
        title="What a caller sees"
        code={`import { WorkerCrashError } from "yatta/runtime";

try {
  await runtime.execute(graphId, "computeReceipt", payload);
} catch (err) {
  if (err instanceof WorkerCrashError) {
    console.log(\`\${err.workerId} (\${err.role}) died: \${err.message}\`);
    // The work is lost, but nothing is left dangling.
  }
}`}
      />

      <Note>
        Recovery is idempotent. A worker firing <Code>error</Code> is always
        followed by <Code>close</Code>, and a <Code>crashed</Code> flag ensures
        replacement happens exactly once. A replacement that itself dies is
        replaced again — tested across cascading crashes.
      </Note>

      <H2>Task deadlines</H2>

      <P>
        Every dispatched task carries a deadline. It starts at dispatch, so time
        spent queued counts against it. When it expires the task is removed from
        the scheduler&apos;s bookkeeping and rejects with{" "}
        <Code>TaskTimeoutError</Code>.
      </P>

      <CodeBlock
        title="Deadlines"
        code={`// Scheduler-wide default
const runtime = createRuntime({ taskTimeoutMs: 30_000 });

// Per subsystem
defineSubsystem({
  name: "exports",
  entrypoint: "./func/exports.ts",
  workload: "cpu",
  timeoutMs: 120_000,   // a long report gets more time
});

// Opt out entirely
defineSubsystem({ name: "worker", ..., timeoutMs: 0 });`}
      />

      <CodeBlock
        title="Catching a timeout"
        code={`import { TaskTimeoutError } from "yatta/runtime";

try {
  await runtime.execute(graphId, "export", payload);
} catch (err) {
  if (err instanceof TaskTimeoutError) {
    console.log(\`\${err.handler} exceeded \${err.timeoutMs}ms\`);
  }
}`}
      />

      <Note kind="warn">
        A deadline frees the host-side promise and the scheduler&apos;s
        bookkeeping — it does not interrupt the worker. A blocking loop inside a
        handler keeps that thread busy until the process restarts. Yield, or move
        genuinely unbounded work into a disposable worker.
      </Note>

      <H2>Graceful shutdown</H2>

      <P>
        On <Code>SIGINT</Code> or <Code>SIGTERM</Code> the scaffolded server:
      </P>

      <UL>
        <LI>Stops accepting new connections</LI>
        <LI>Waits up to ten seconds for in flight tasks to finish</LI>
        <LI>Only then terminates the worker threads</LI>
      </UL>

      <CodeBlock
        title="shutdown"
        code={`const server = Bun.serve({ /* … */ });

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  server.stop(true);
  console.log("[shutdown] draining…");

  const drained = await runtime.drain(10_000);
  if (!drained) {
    console.warn(\`\${runtime.getActiveTaskCount()} task(s) still in flight — forcing.\`);
  }

  await runtime.shutdown();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());`}
      />

      <P>
        The re-entrancy guard matters: a second signal arriving while draining
        must not start a second teardown.
      </P>

      <H2>Draining manually</H2>

      <CodeBlock
        code={`// Resolves true if the fleet went idle, false on timeout
const clean = await runtime.drain(5_000);

console.log(runtime.getActiveTaskCount()); // in flight + queued`}
      />

      <H2>Error types</H2>

      <CodeBlock
        title="import { WorkerCrashError, TaskTimeoutError } from 'yatta/runtime'"
        lang="ts"
        code={`class WorkerCrashError extends Error {
  workerId: string;
  role: "cpu-pool" | "io-pool" | "dedicated";
}

class TaskTimeoutError extends Error {
  graphId: string;
  handler: string;
  timeoutMs: number;
}`}
      />

      <H2>Multi-process notes</H2>

      <P>
        Under <Code>SO_REUSEPORT</Code> several OS processes share the port and
        the database. SQLite is opened in WAL mode with a busy timeout, and
        schema creation runs under <Code>BEGIN IMMEDIATE</Code> with retries, so
        concurrent boots are safe.
      </P>

      <Note kind="warn">
        Supervision is per-process. If an entire cluster member dies, the load
        balancer must replace it — no in-process supervisor can observe a
        process that is gone. Use the readiness probe as the signal.
      </Note>

      <DocFooter
        prev={{ href: "/docs/runtime", title: "Worker runtime" }}
        next={{ href: "/docs/types", title: "Typed keys" }}
      />
    </article>
  );
}
