import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Worker runtime — YATTA Docs",
  description:
    "Yatta's hardware-aware scheduler: CPU and I/O pools, isolated subsystems, least-loaded dispatch, and micro-batching.",
};

export default function RuntimeDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "The runtime" },
          { label: "Worker runtime" },
        ]}
      />
      <H1 eyebrow={'The runtime'} sub="Most runtimes give you one worker per core and let you guess which task is blocking. Yatta splits work into two pools so the answer is built in.">
        Worker runtime
      </H1>

      <H2>Two pools</H2>

      <P>
        The scheduler reads <Code>navigator.hardwareConcurrency</Code> at
        startup and sizes two pools from it.
      </P>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">cpu-pool</strong> —{" "}
          <Code>cores * 0.35</Code> workers, concurrency{" "}
          <strong className="text-[#f3eed7]/70">1</strong>. Hashing, crypto,
          compression. One task at a time so a heavy job cannot starve its
          neighbours.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">io-pool</strong> —{" "}
          <Code>min(16, cores * 0.8)</Code> workers, concurrency{" "}
          <strong className="text-[#f3eed7]/70">500</strong>. Database
          queries, HTTP, mail. Many tasks in flight per worker.
        </LI>
      </UL>

      <P>
        On a two-core machine that is 1 CPU worker and 2 I/O workers. On small
        hosts I/O workers also start with Bun&apos;s <Code>smol</Code> heap to
        keep memory down.
      </P>

      <H2>Subsystems</H2>

      <P>
        A subsystem is a module mounted as an isolated graph. Each file in{" "}
        <Code>yatta/func/</Code> is one.
      </P>

      <CodeBlock
        title="yatta/main.ts"
        code={`import { createRuntime, defineSubsystem } from "yatta.js/runtime";

const runtime = createRuntime({ taskTimeoutMs: 30_000 });
await runtime.start();

const graphId = await runtime.registerSubsystem(
  defineSubsystem({
    name: "billing",
    entrypoint: new URL("./func/billing.ts", import.meta.url),
    workload: "cpu",
  }),
);

// Dispatch a named export from that module.
const receipt = await runtime.execute(graphId, "computeReceipt", payload);`}
      />

      <PropsSmall />

      <H2>Choosing the workload</H2>

      <CodeBlock
        title="cpu or io"
        code={`// CPU-bound: Argon2id, AES, image work, large JSON transforms
defineSubsystem({ name: "auth", workload: "cpu", ... })

// I/O-bound: SQLite, fetch, mail, S3
defineSubsystem({ name: "db", workload: "io", ... })`}
      />

      <Note>
        Marking something <Code>cpu</Code> is how you tell the scheduler it may
        block. Getting it wrong is the usual cause of &ldquo;my server freezes under
        load&rdquo;.
      </Note>

      <H2>Dispatch</H2>

      <P>
        The scheduler picks the least-loaded worker for the graph. When every
        slot is busy the task waits in a fast queue and is drained as capacity
        frees up.
      </P>

      <CodeBlock
        title="Dispatch"
        code={`// Fire and forget
void runtime.execute(graphId, "sendReport", { id: 1 });

// Await
const result = await runtime.execute(graphId, "computeReceipt", payload);

// Concurrent calls share the workers
await Promise.all(
  orders.map((o) => runtime.execute(graphId, "computeReceipt", o)),
);`}
      />

      <H2>Micro-batching</H2>

      <P>
        Under a backlog the scheduler stops sending one message per task and
        packs up to 32 into a single IPC message (64 past 256 queued). This
        removes most of the thread-hop cost under burst load without changing
        your code.
      </P>

      <H2>Inspecting the fleet</H2>

      <CodeBlock
        title="Introspection"
        code={`console.log(runtime.getTopology());
// {
//   cpuCores: 2,
//   cpuWorkers: 1,
//   ioWorkers: 2,
//   totalWorkers: 3,
//   suggestSmol: true
// }

console.log(runtime.getActiveTaskCount()); // in flight + queued`}
      />

      <H2>Environment</H2>

      <P>Each subsystem can override the scheduler-wide deadline:</P>

      <CodeBlock
        code={`const runtime = createRuntime({
  cpuWorkers: 2,       // override the computed default
  ioWorkers: 4,
  taskTimeoutMs: 30_000,
  silent: false,       // suppress the startup banner
});

// Per-subsystem
defineSubsystem({
  name: "exports",
  entrypoint: "./func/exports.ts",
  workload: "cpu",
  timeoutMs: 120_000,  // a long report gets more time
});`}
      />

      <Note kind="warn">
        Setting <Code>timeoutMs: 0</Code> disables the deadline for that
        subsystem. Only do this for work you control — see{" "}
        <a href="/docs/reliability" className="underline underline-offset-4">
          Reliability
        </a>{" "}
        for what an unbounded task costs.
      </Note>

      <DocFooter
        prev={{ href: "/docs/layout", title: "Project layout" }}
        next={{ href: "/docs/reliability", title: "Reliability" }}
      />
    </article>
  );
}

function PropsSmall() {
  return (
    <div className="my-6 divide-y divide-[#f3eed7]/10 border-y border-[#f3eed7]/10">
      {[
        { name: "name", type: "string", desc: "Unique subsystem name; the graph id is graph-<name>." },
        { name: "entrypoint", type: "URL | string", desc: "Module to mount. Exported functions become dispatchable handlers." },
        { name: "workload", type: '"cpu" | "io"', desc: "Selects the pool." },
        { name: "env", type: "Record<string, string>", desc: "Extra environment overlay visible inside the subsystem." },
        { name: "timeoutMs", type: "number", desc: "Per-subsystem deadline. 0 disables." },
      ].map((item) => (
        <div key={item.name} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <code className="font-mono text-[13px] text-[#f3eed7]/80">{item.name}</code>
            <span className="font-mono text-[11px] text-[#f3eed7]/30">{item.type}</span>
          </div>
          <div className="text-[14px] leading-[1.7] text-[#f3eed7]/45">{item.desc}</div>
        </div>
      ))}
    </div>
  );
}
