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
  title: "Todo API — YATTA Examples",
  description:
    "A complete Yatta todo API: session auth, ownership checks, body validation, cache-aside reads, and a daily digest job.",
};

export default function TodoApiExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Todo API" },
        ]}
      />

      <H1
        eyebrow="Examples"
        sub="Session auth, per-user isolation, validated bodies, cache-aside reads, and a job that runs while nobody is waiting."
      >
        Todo API
      </H1>

      <P>
        The shape most real backends need: authenticated reads and writes,
        ownership enforced on every mutation, a hot read served from cache, and
        a slow digest moved off the request path.
      </P>

      <H2 id="layout">File layout</H2>

      <CodeBlock
        code={`yatta/
├── backend/
│   ├── auth.ts          signup, signin, signout
│   ├── todos.ts         the CRUD routes
│   └── digest.ts        the daily email job
└── func/
    ├── db.ts            schema + client
    ├── auth.ts          createAuth
    ├── cache.ts         createCache
    ├── jobs.ts          handlers
    └── middleware.ts    withSession, requireAuth`}
      />

      <H2 id="schema">Schema</H2>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta/db";

export const schema = {
  todos: {
    id: col.uuid(),
    userId: col.text().references("users.id", { onDelete: "CASCADE" }),
    title: col.text(),
    done: col.boolean().default(false),
    dueAt: col.date().nullable(),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  },
};

export const db = createDatabase({
  url: process.env.DATABASE_URL,
  schema,
});`}
      />

      <Callout kind="note">
        <code>userId</code> is a real column carrying a foreign key, not a field
        in a JSON blob. That is what lets SQLite enforce the cascade: deleting
        a user deletes their todos without an application-level cleanup pass.
      </Callout>

      <H2 id="middleware">Middleware</H2>

      <P>
        Resolve the session once, then reject unauthenticated requests before
        any handler runs. Handlers read <code>ctx.state.user</code> instead of
        re-parsing cookies.
      </P>

      <CodeBlock
        title="yatta/func/middleware.ts"
        code={`import type { Middleware } from "yatta/api";
import { UnauthorizedError } from "yatta/auth";
import type { PublicUser } from "yatta/auth";
import { auth } from "./auth";

// Runs once per request; cheap enough not to memoise, correct enough not to
// skip.
export const withSession: Middleware = async (ctx, next) => {
  const found = await auth.getSession(ctx.req, { autoRefresh: true });

  ctx.state.user = found?.user ?? null;

  const res = await next();

  // getSession may have rotated the refresh token.
  if (found?.newCookies?.length) {
    const headers = new Headers(res.headers);
    for (const c of found.newCookies) headers.append("Set-Cookie", c);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return res;
};

export const requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.state.user) throw new UnauthorizedError();
  return next();
};

export function currentUser(ctx: { state: Record<string, unknown> }): PublicUser {
  return ctx.state.user as PublicUser;
}`}
      />

      <H2 id="auth-routes">Auth routes</H2>

      <CodeBlock
        title="yatta/backend/auth.ts"
        code={`import { createAPI } from "yatta/api";
import { auth } from "../func/auth";

const route = createAPI("/auth");

route.post("/signup", async (ctx) => {
  const { email, password } = await ctx.json();

  const result = await auth.signUp({ email, password, req: ctx.req });

  if ("emailVerificationRequired" in result) {
    return todos.json(
      { ok: true, message: "Check your email to verify your account." },
      { status: 202 },
    );
  }

  return route
    .json({ ok: true, user: result.user }, { status: 201 })
    .withCookies(todos, result.cookies);
});

route.post("/signin", async (ctx) => {
  const { email, password, mfaCode } = await ctx.json();

  const result = await auth.signIn({ email, password, mfaCode, req: ctx.req });

  if ("mfaRequired" in result) {
    return todos.json({ mfaRequired: true }, { status: 401 });
  }

  return route
    .json({ ok: true, user: result.user })
    .withCookies(todos, result.cookies);
});

route.post("/signout", async (ctx) => {
  const { success, cookies } = await auth.signOut(ctx.req);
  return todos.json({ ok: success }).withCookies(todos, cookies);
});

export default route;`}
      />

      <H2 id="crud">CRUD with ownership</H2>

      <P>
        The important part is the read query. Every query filters by{" "}
        <code>userId</code> from the session — never from the request body —
        and the mutation re-checks ownership before writing.
      </P>

      <CodeBlock
        title="yatta/backend/todos.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { and } from "yatta/db";
import { db } from "../func/db";
import { cache } from "../func/cache";
import { requireAuth, withSession } from "../func/middleware";

const todos = createAPI("/todos");

todos.use(withSession);
todos.use(requireAuth);

// ── List ────────────────────────────────────────────────────────────────
// Cached per user. The tag is what lets a mutation invalidate it precisely.
todos.get("/", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;

  const key = \`todos:list:\${userId}\`;
  const cached = await cache.get<unknown[]>(key);
  if (cached) return todos.json(cached);

  const rows = await db.todos
    .where((f) => f.userId.isEqualTo(userId))
    .orderBy({ createdAt: "desc" })
    .all();

  await cache.set(key, rows, {
    ttl: "30s",
    tags: [\`todos:\${userId}\`],
  });
  return todos.json(rows);
});

// ── Create ──────────────────────────────────────────────────────────────
todos.post("/", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;
  const body = await ctx.json();

  if (!body.title || typeof body.title !== "string") {
    throw new HttpError(400, "title is required");
  }

  const todo = await db.todos.insert({
    userId,
    title: body.title.slice(0, 200),
    done: false,
    dueAt: body.dueAt ?? null,
  });

  // Precise invalidation, not a blanket flush.
  await cache.invalidateTags(\`todos:\${userId}\`);

  return todos.json(todo, { status: 201 });
});

// ── Update ──────────────────────────────────────────────────────────────
todos.patch("/:id", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;
  const body = await ctx.json();

  // Ownership is part of the WHERE clause, not a read-then-compare: two
  // concurrent requests cannot both pass a check that happens before the write.
  const existing = await db.todos
    .where((f) => and(
      f.id.isEqualTo(ctx.params.id),
      f.userId.isEqualTo(userId),
    ))
    .first();

  // No match means either it does not exist or it is not yours. Same response
  // for both, so this is not an existence oracle.
  if (!existing) throw new HttpError(404, "Not found");

  await db.todos
    .where((f) => f.id.isEqualTo(existing.id))
    .update({ ...body, updatedAt: new Date() });

  await cache.invalidateTags(\`todos:\${userId}\`);

  return todos.json({ ...existing, ...body });
});

// ── Delete ──────────────────────────────────────────────────────────────
todos.delete("/:id", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;

  const existing = await db.todos
    .where((f) => and(
      f.id.isEqualTo(ctx.params.id),
      f.userId.isEqualTo(userId),
    ))
    .first();

  if (!existing) throw new HttpError(404, "Not found");

  await db.transaction(async (tx) => {
    await tx.todos.where((f) => f.id.isEqualTo(existing.id)).delete();
  });

  await cache.invalidateTags(\`todos:\${userId}\`);

  return new Response(null, { status: 204 });
});

export default todos;`}
      />

      <Callout kind="warn">
        The ownership check belongs in the <code>WHERE</code> clause, not in a
        read-then-compare in JavaScript. Two requests racing on the same row can
        both pass a check that happens before the write.
      </Callout>

      <H2 id="pagination">Cursor pagination</H2>

      <P>
        Offset pagination breaks on writes — insert a row and every page after
        it shifts. Page on the sort key itself.
      </P>

      <CodeBlock
        title="appending to the list route"
        code={`todos.get("/", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;
  const limit = Math.min(Number(ctx.query().limit ?? 50), 100);
  const cursor = ctx.query().cursor;   // an ISO timestamp

  const rows = await db.todos
    .where((f) => and(
      f.userId.isEqualTo(userId),
      f.createdAt.isLessThan(cursor ?? new Date().toISOString()),
    ))
    .orderBy({ createdAt: "desc" })
    .limit(limit + 1);                // one extra tells us if more exist

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return todos.json({
    items: page,
    nextCursor: hasMore ? page[page.length - 1].createdAt : null,
  });
});`}
      />

      <H2 id="digest-job">The digest job</H2>

      <P>
        Reporting is the classic thing that must not happen inside a request.
        Enqueue it and return.
      </P>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs } from "yatta/jobs";

export const jobs = createJobs();

export interface JobHandlers {
  "todo-digest": { userId: string };
}

jobs.handle("todo-digest", async (payload, ctx) => {
  const user = await db.users
    .where((f) => f.id.isEqualTo(payload.userId))
    .first();

  if (!user?.email) return;

  const open = await db.todos
    .where((f) => and(
      f.userId.isEqualTo(payload.userId),
      f.done.isEqualTo(false),
    ))
    .all();

  // Long job, visible progress.
  ctx.progress(50, "Composing digest");

  await mail.send({
    to: user.email,
    subject: \`\${open.length} open \${open.length === 1 ? "todo" : "todos"}\`,
    template: "digest",
    props: { items: open },
  });

  ctx.progress(100, "Sent");
});`}
      />

      <CodeBlock
        title="enqueue it from a cron"
        code={`import { createCron } from "yatta/jobs";
import { db } from "./db";

export const cron = createCron(jobs);

cron.schedule("0 8 * * *", async () => {
  const users = await db.users.all();

  for (const user of users) {
    await jobs.enqueue("todo-digest", { userId: user.id }, {
      priority: "low",
      retry: { attempts: 3 },
    });
  }
});`}
      />

      <Callout kind="tip">
        One job per user rather than one job for all users. A single job that
        loops over a thousand users runs for a long time, holds one lease, and
        retries all-or-nothing. Per-user jobs fan out across the worker pool and
        one failure does not take the batch with it.
      </Callout>

      <H2 id="error-handling">One error shape</H2>

      <CodeBlock
        title="yatta/backend/todos.ts"
        code={`import { ValidationError, HttpError } from "yatta/api";

todos.onError((error, ctx) => {
  if (error instanceof ValidationError) {
    return Response.json(
      { error: "Invalid request", issues: error.issues },
      { status: 422 },
    );
  }

  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[todos]", error);

  return Response.json({ error: "Internal Server Error" }, { status: 500 });
});`}
      />

      <DocFooter
        prev={{ href: "/docs/examples", title: "Examples" }}
        next={{ href: "/docs/examples/image-pipeline", title: "Image pipeline" }}
      />
    </article>
  );
}
