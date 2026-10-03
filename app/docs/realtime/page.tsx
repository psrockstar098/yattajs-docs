import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Realtime — YATTA Docs",
  description:
    "WebSockets and SSE through one interface, with topic pub/sub, authentication, backpressure, and AI token streaming.",
};

export default function RealtimeDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Realtime" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Clients connect over WebSocket or plain HTTP streaming — the same handlers serve both, chosen automatically from the request.">
        Realtime
      </H1>

      <H2>Setup</H2>

      <CodeBlock
        title="yatta/func/realtime.ts"
        code={`import { createRealtime } from "yatta/realtime";

export const realtime = createRealtime({
  handlers: {
    open(client) {
      console.log(\`connected: \${client.id}\`);
    },

    message(client, event, data) {
      client.send(event, data);   // echo
    },

    close(client) {
      console.log(\`disconnected: \${client.id}\`);
    },
  },
});`}
      />

      <H2>Wiring it up</H2>

      <CodeBlock
        title="yatta/main.ts"
        code={`import { realtime } from "./func/realtime";
import routers from "./func/routerHelper";

const server = Bun.serve({
  port: 4000,
  fetch: (req, srv) => routers(req, srv),
  websocket: realtime.websocket,   // required for upgrades
});`}
      />

      <P>
        <Code>routerHelper</Code> routes <Code>/realtime</Code> to the engine,
        which picks WebSocket or SSE based on the request.
      </P>

      <H2>Broadcasting</H2>

      <CodeBlock
        title="Publish"
        code={`// Everyone subscribed to the topic
realtime.to("orders").publish("order.updated", { id: 1, total: 42 });

// A named room
const room = realtime.room("support");
room.publish("agent.joined", { name: "Ada" });

// An SSE channel specifically
realtime.channel("notifications").broadcast("ping", { at: Date.now() });`}
      />

      <H2>Authentication</H2>

      <P>
        The hook runs on every connection. Return the session data to allow it,
        or <Code>null</Code> to reject with a 401.
      </P>

      <CodeBlock
        title="authenticate"
        code={`export const realtime = createRealtime({
  async authenticate(req) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return null;

    const session = await auth.getSession(token);
    if (!session) return null;

    return { userId: session.user.id, roles: session.user.roles };
  },

  handlers: {
    open: (c) => console.log(c.data.userId),
    message: (c, e, d) => c.send(e, d),
  },
});`}
      />

      <P>
        Client data is typed, so <Code>client.data.userId</Code> is a{" "}
        <Code>string</Code> rather than <Code>unknown</Code>.
      </P>

      <CodeBlock
        title="Typed session"
        code={`export const realtime = createRealtime<{ userId: string }>({
  /* … */
});`}
      />

      <H2>Authorization</H2>

      <CodeBlock
        title="Guards"
        code={`export const realtime = createRealtime({
  authorize: {
    // Before a client joins a topic
    join: (client, topic) => client.data.roles.includes("admin"),

    // Before an inbound message reaches the handler
    send: (client, event, data) => event !== "admin.delete",
  },

  validate: (event, data) => {
    if (event === "chat.message" && typeof data !== "object") {
      return { valid: false, error: "payload must be an object" };
    }
    return true;
  },
});`}
      />

      <H2>Topics and rooms</H2>

      <CodeBlock
        title="Client side"
        code={`// Joining is permission-checked by authorize.join
client.join("orders");

// Rooms scope a broadcaster
const room = realtime.room("support");
room.broadcast("agent.joined", { name: "Ada" });

// Namespace every topic under a prefix — handy for multi-tenant apps
const tenant = realtime.namespace("tenant:acme");
tenant.to("orders").publish("updated", { id: 1 });`}
      />

      <H2>Streaming LLM output</H2>

      <P>
        <Code>streamText</Code> emits a chunk event per token and always
        finishes with a terminal <Code>done</Code> or <Code>error</Code> frame.
      </P>

      <CodeBlock
        title="yatta/backend/ai.ts"
        code={`import { API, createAPI } from "yatta/api";
import { SSEClient } from "yatta/realtime";

const api = createAPI();

api.get(async (ctx) => {
  const client = new SSEClient(ctx.req);

  await client.streamText(llm.stream("Tell me a joke"), {
    eventName: "ai:stream",
    streamId: "session-123",
    usage: () => ({ inputTokens: 10, outputTokens: 25 }),
  });

  return new Response(client.readable, {
    headers: { "Content-Type": "text/event-stream" },
  });
});

export default api;`}
      />

      <Note>
        A disconnect mid-stream aborts the iterator and emits a{" "}
        <Code>done</Code> frame with <Code>{"reason: \"aborted\""}</Code>, so
        clients never hang waiting for a stream that stopped.
      </Note>

      <H2>Job progress</H2>

      <CodeBlock
        title="Tracking a job"
        code={`const tracker = realtime.job(jobId);

tracker.progress(25, "Uploading");
tracker.progress(100, "Done");
tracker.done({ url });
tracker.fail(new Error("Upload failed"));`}
      />

      <H2>Client SDK</H2>

      <CodeBlock
        title="Browser"
        code={`import { Realtime } from "yatta/realtime";

const rt = new Realtime("/realtime");

rt.on("order.updated", (data) => {
  console.log("order", data.id);
});

// Falls back to SSE, reconnects with exponential backoff
rt.connect();`}
      />

      <H2>Backpressure</H2>

      <P>
        A slow consumer is capped rather than allowed to grow the heap without
        bound. On overflow you are notified and can close the connection.
      </P>

      <CodeBlock
        title="Limits"
        code={`export const realtime = createRealtime({
  sseOptions: {
    maxBufferedEvents: 1024,
    heartbeatInterval: 15_000,
    onBackpressure: (client) => {
      console.warn("client too slow, closing");
      client.close();
    },
  },
});`}
      />

      <DocFooter
        prev={{ href: "/docs/mail", title: "Mail" }}
        next={{ href: "/docs/api", title: "HTTP API" }}
      />
    </article>
  );
}
