import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Full-stack Next.js app — YATTA Examples",
  description:
    "Every Yatta subsystem in one project with a Next.js frontend: auth, database, jobs, events, storage, mail, cache, realtime and observability.",
};

export default function FullstackNextExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Full-stack Next.js app" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Every subsystem in one project, with a Next.js frontend talking to a Yatta backend — and one trace tying the two together.">
        Full-stack Next.js app
      </H1>

      <H2 id="layout">Layout</H2>

      <P>Two processes. The frontend is Next.js; the backend is Yatta on its own port. They are separate deployables, which means the frontend can be a CDN cache and the backend can scale on its own.</P>

      <CodeBlock
        code={`my-app/
├── web/                     Next.js frontend
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── UploadDropzone.tsx
│   │   ├── JobProgress.tsx
│   │   └── LiveFeed.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── observe.ts       ← RUM agent
│   └── .env.local           NEXT_PUBLIC_API_URL=http://localhost:4000
│
└── api/                     Yatta backend
    ├── src/main.ts
    ├── yatta/
    │   ├── func/
    │   │   ├── auth.ts  db.ts  cache.ts  jobs.ts
    │   │   ├── events.ts  storage.ts  mail.ts  observe.ts
    │   └── backend/
    │       ├── auth.ts  documents.ts  realtime.ts  feedback.ts
    └── .env                 API_URL, AUTH_SECRET, DATABASE_URL`}
      />

      <H2 id="cors">CORS, once</H2>

      <P>With credentials on, the allowed origin has to be exact. A wildcard is rejected by the browser and would be wrong anyway.</P>

      <CodeBlock
        title="api/yatta/backend/index.ts"
        code={`import { createAPI } from "yatta/api";

const api = createAPI("/api");

// Exact origins, and credentials so the session cookie travels.
api.cors({
  origin: [
    process.env.WEB_ORIGIN ?? "http://localhost:3000",
    "https://app.example.com",
  ],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
});

export default api;`}
      />

      <H2 id="auth">Auth, shared between both apps</H2>

      <P>The backend owns the session. The frontend never sees a token — it calls <code>withCredentials</code> and the cookie does the work.</P>

      <CodeBlock
        title="web/lib/api.ts"
        code={`const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    ...init,
    // The session cookie must travel; without this every call is anonymous.
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText, await res.json().catch(() => null));
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get:  <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body: unknown) =>
    request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del:  <T>(p: string) => request<T>(p, { method: "DELETE" }),
};`}
      />

      <H2 id="rum">One trace across both</H2>

      <P>
        Propagate the traceparent yourself. There is no browser agent in the
        framework &mdash; <code>rumScript()</code> exists but nothing loads it and
        there is no ingest endpoint, so emitting it would be a no-op. What does
        work is minting a W3C header on the client; the server adopts it and the
        SQLite query it caused lands in the same trace.
      </P>

      <CodeBlock
        title="web/app/TraceProvider.tsx"
        code={`"use client";

const hex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function traceparent() {
  // W3C trace-context: version 00, 16-byte trace id, 8-byte span id, flags 01
  // (sampled). Reuse the existing value so every fetch in this page shares a
  // trace instead of starting a new one per call.
  const existing =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("yatta-traceparent")
      : null;

  if (existing) return existing;

  const header = \`00-\${hex(16)}-\${hex(8)}-01\`;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("yatta-traceparent", header);
  }
  return header;
}

export function TraceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}`}
      />

      <H2 id="route">A route that uses most of it</H2>

      <P>Auth, validation, database, events, jobs, cache and observability in one handler — which is what a real endpoint looks like.</P>

      <CodeBlock
        title="api/yatta/backend/documents.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { z } from "zod";
import { and } from "yatta/db";
import { db } from "../func/db";
import { auth } from "../func/auth";
import { cache } from "../func/cache";
import { jobs } from "../func/jobs";
import { events } from "../func/events";
import { storage } from "../func/storage";
import { mail } from "../func/mail";
import { observer } from "../func/observe";
import { requireAuth } from "../func/middleware";

const api = createAPI("/api/documents");

api.use(requireAuth);

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(100_000),
  notifyEmail: z.string().email().optional(),
});

api.post("/", async (ctx) => {
  const user = ctx.state.user as { id: string; email: string };

  // 422 with the failing field, not a 500 from deep inside the ORM.
  const parsed = CreateSchema.safeParse(await ctx.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid document", parsed.error.issues);
  }

  return observer.traceDb("insert", async (span) => {
    const document = await db.documents.insert({
      userId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      status: "draft",
    });

    // Anything can react — indexing, notifications, webhooks.
    await events.emit("document.created", {
      documentId: document.id,
      userId: user.id,
      title: document.title,
    });

    // Slow follow-up work, off the request path.
    await jobs.enqueue("document:thumbnail", { documentId: document.id });

    if (parsed.data.notifyEmail) {
      await jobs.enqueue("document:notify", {
        documentId: document.id,
        to: parsed.data.notifyEmail,
      });
    }

    span.setAttribute("document.id", document.id);
    return Response.json(document, { status: 201 });
  });
});

api.get("/", async (ctx) => {
  const user = ctx.state.user as { id: string };

  // Hot read, cached per user and invalidated on write.
  const key = \`docs:list:\${user.id}\`;
  const cached = await cache.get<unknown[]>(key);
  if (cached) return Response.json(cached);

  const rows = await db.documents
    .where((f) => f.userId.isEqualTo(user.id))
    .orderBy({ updatedAt: "desc" })
    .limit(50)
    .all();

  await cache.set(key, rows, { ttl: "30s", tags: [\`docs:\${user.id}\`] });

  return Response.json(rows);
});`}
      />

      <H2 id="worker">The worker side</H2>

      <CodeBlock
        title="api/yatta/func/jobs.ts"
        code={`export interface JobHandlers {
  "document:thumbnail": { documentId: string };
  "document:notify": { documentId: string; to: string };
}

jobs.handle("document:thumbnail", async ({ documentId }, ctx) => {
  const doc = await db.documents.findById(documentId);
  if (!doc) return;

  ctx.progress(30, "Rendering");

  const pdf = await renderPdf(doc);
  const key = \`documents/\${doc.userId}/\${documentId}.pdf\`;

  await storage.put(key)
    .from(pdf)
    .withContentType("application/pdf")
    .asPrivate()
    .maxSize("10mb");

  await db.documents.where((f) => f.id.isEqualTo(documentId)).update({
    pdfKey: key, status: "ready",
  });

  ctx.progress(100, "Done");
});

jobs.handle("document:notify", async ({ documentId, to }) => {
  const doc = await db.documents.findById(documentId);

  await mail.send({
    to,
    subject: \`Your document is ready\`,
    template: "document-ready",
    props: { title: doc.title, documentId: doc.id },
  });
});`}
      />

      <H2 id="realtime">Realtime in React</H2>

      <P>The SSE endpoint streams job progress and realtime events into React state, so the UI needs no polling.</P>

      <CodeBlock
        title="web/components/JobProgress.tsx"
        code={`"use client";

import { useEffect, useState } from "react";

interface Progress { percent: number; message: string }

export function JobProgress({ url }: { url: string }) {
  const [progress, setProgress] = useState<Progress>({ percent: 0, message: "Queued" });
  const [done, setDone] = useState(false);

  useEffect(() => {
    // EventSource reconnects on its own; close it or it retries forever.
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("progress", (e) => {
      setProgress(JSON.parse(e.data));
    });

    es.addEventListener("done", () => {
      setDone(true);
      es.close();
    });

    return () => es.close();
  }, [url]);

  if (done) return <p className="text-sm text-emerald-600">Ready</p>;

  return (
    <div>
      <div className="h-1.5 w-full rounded bg-black/10">
        <div
          className="h-full rounded bg-emerald-500 transition-all"
          style={{ width: \`\${progress.percent}%\` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-black/50">{progress.message}</p>
    </div>
  );
}`}
      />

      <CodeBlock
        title="web/components/LiveFeed.tsx"
        code={`"use client";

import { useEffect, useState } from "react";

interface FeedItem { id: string; title: string; at: string }

export function LiveFeed({ room }: { room: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    const es = new EventSource(
      \`\${process.env.NEXT_PUBLIC_API_URL}/api/feed/\${room}\`,
      { withCredentials: true },
    );

    es.addEventListener("document.created", (e) => {
      const doc = JSON.parse(e.data) as FeedItem;
      // Newest first, bounded so a long session does not grow forever.
      setItems((prev) => [doc, ...prev].slice(0, 50));
    });

    return () => es.close();
  }, [room]);

  return (
    <ul>
      {items.map((i) => (
        <li key={i.id}>{i.title}</li>
      ))}
    </ul>
  );
}`}
      />

      <H2 id="feedback">Closing the loop</H2>

      <P>The agent reports back a trace id; the user reports a problem with the same id attached. That is the whole point of tracing from the browser.</P>

      <CodeBlock
        title="web/components/FeedbackButton.tsx"
        code={`"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    await api.post("/api/feedback", {
      message,
      rating: 2,
      // The browser agent generated this; it ties the report to the exact
      // request the user was looking at.
      traceId: window.yatta?.traceId?.(),
      url: location.href,
    });
    setSent(true);
  }

  if (sent) return <p className="text-sm">Thanks — that is genuinely useful.</p>;

  return (
    <div>
      <button onClick={() => setOpen(true)}>Report a problem</button>
      {open && (
        <div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          <button onClick={submit}>Send</button>
        </div>
      )}
    </div>
  );
}`}
      />

      <CodeBlock
        title="api/yatta/backend/feedback.ts"
        code={`import { createAPI } from "yatta/api";
import { observer } from "../func/observe";

const api = createAPI("/api/feedback");

api.post("/", async (ctx) => {
  const body = (await ctx.json()) as Record<string, unknown>;
  const message = String(body.message ?? "").trim();

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // There is no feedback store in the framework — user feedback is not a
  // shipped feature. The audit log is the built-in place to record an event
  // like this; persist it yourself if you need to query it later.
  observer.recordAudit({
    action: "feedback.submit",
    target: typeof body.traceId === "string" ? body.traceId : undefined,
    actor: "frontend",
    traceId: typeof body.traceId === "string" ? body.traceId : undefined,
  });

  return Response.json({ ok: true }, { status: 201 });
});`}
      />

      <Callout kind="tip">Passing <code>traceId</code> with the feedback is what turns &ldquo;it was broken this morning&rdquo; into a specific failing trace you can open. It is two lines and it changes every support conversation.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/incident-console", title: "Incident console" }}
        next={{ href: "/docs/examples", title: "Examples" }}
      />
    </article>
  );
}
