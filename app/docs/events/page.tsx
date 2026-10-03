import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1, H2, P, Code, Note, DocFooter, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Events — YATTA Docs",
  description:
    "A typed event bus wired to the job queue: listeners, wildcards, waiting for an event, and piping an event straight into background work.",
};

export default function EventsDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Events" },
        ]}
      />
      <H1
        eyebrow="Engines"
        sub="Decouple what happens from where it happens. Emit an event, and anything can listen — or the event can become a background job without a line of glue code."
      >
        Events
      </H1>

      <H2 id="setup">Setup</H2>

      <P>
        The bus is typed the same way jobs are: declare your event names once
        and every <Code>on</Code>, <Code>emit</Code> and <Code>pipe</Code> call
        is checked.
      </P>

      <CodeBlock
        title="yatta/func/events.ts"
        code={`import { createEvents } from "yatta/jobs";
import { jobs } from "./jobs";

export interface AppEvents {
  "user.registered": { userId: string; email: string };
  "order.completed": { orderId: string; amount: number };
  "payment.failed": { orderId: string; reason: string };
}

declare module "yatta/jobs" {
  interface EventRegister extends AppEvents {}
}

export const events = createEvents(jobs);`}
      />

      <H2 id="listening">Listening</H2>

      <CodeBlock
        title="on"
        code={`events.on("user.registered", (data) => {
  console.log(\`new user: \${data.email}\`);
});

events.once("order.completed", (data) => {
  console.log(\`first order only: \${data.orderId}\`);
});`}
      />

      <P>
        Listeners may be async, and run concurrently. A listener that throws
        does not stop the others.
      </P>

      <H2 id="emitting">Emitting</H2>

      <CodeBlock
        title="emit"
        code={`await events.emit("user.registered", {
  userId: user.id,
  email: user.email,
});`}
      />

      <CodeBlock
        title="collect errors instead of throwing"
        code={`// By default a throwing listener propagates.
try {
  await events.emit("user.registered", data);
} catch (err) {
  console.error("listener failed", err);
}

// Or collect every failure and throw an AggregateError at the end.
await events.emit("user.registered", data, { throwOnError: true });`}
      />

      <H2 id="patterns">Patterns</H2>

      <P>
        Besides exact names, the bus matches on prefix, suffix and a global
        wildcard.
      </P>

      <CodeBlock
        title="wildcards"
        code={`events.on("order.created", handler);   // exact
events.on("order.*", handler);      // prefix
events.on("*.created", handler);    // suffix
events.on("*", handler);            // everything`}
      />

      <P>This is how you attach auditing without touching business logic:</P>

      <CodeBlock
        code={`// Any event can be audited without knowing its name in advance.
events.on("*", async (data, eventName) => {
  await db.auditLog.insert({
    event: eventName,
    payload: JSON.stringify(data),
  });
});`}
      />

      <H2 id="waiting">Waiting for an event</H2>

      <P>
        Sometimes you need to block on something rather than react to it.{" "}
        <Code>waitFor</Code> resolves when the event fires, or rejects on
        timeout.
      </P>

      <CodeBlock
        title="waitFor"
        code={`const payment = await events.waitFor("payment.confirmed", "1m");
// → the event payload

// Rejects with a QueueError if the event never arrives
try {
  await events.waitFor("never.happens", "20s");
} catch (err) {
  // QueueError: Timeout waiting for event "never.happens"
}`}
      />

      <H2 id="piping-to-jobs">Piping to jobs</H2>

      <P>
        This is the reason to use events over direct calls. The event fires,
        and a background job is enqueued — the handler runs on a worker, so a
        slow or failing email cannot slow down or break the request that
        triggered it.
      </P>

      <CodeBlock
        title="pipe"
        code={`events.pipe(
  "user.registered",
  "send-welcome",
  undefined,
  (data) => ({ to: data.email, name: data.name }),
);`}
      />

      <P>
        The signature matters. The third argument is enqueue{" "}
        <em>options</em>; the fourth maps the event payload to the job payload.
        Passing a payload in the third position will not type-check.
      </P>

      <CodeBlock
        title="with options"
        code={`events.pipe(
  "order.completed",
  "send-receipt",
  { delay: "5m", priority: "low" },
  (data) => ({ to: lookupEmail(data.orderId), orderId: data.orderId }),
);`}
      />

      <Note>
        Because the job runs on a worker, emitting is cheap: the handler returns
        as soon as the job is queued. That is the difference between a signup
        request that takes 40ms and one that takes four seconds.
      </Note>

      <H2 id="unsubscribing">Unsubscribing</H2>

      <P>
        <Code>on</Code> returns an unsubscribe function.
      </P>

      <CodeBlock
        code={`const off = events.on("user.registered", handler);

off();   // stop listening`}
      />

      <DocFooter
        prev={{ href: "/docs/jobs", title: "Job queue" }}
        next={{ href: "/docs/cache", title: "Cache" }}
      />
    </article>
  );
}
