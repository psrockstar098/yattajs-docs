import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "HTTP API — YATTA Docs",
  description:
    "File-based routing with typed params, onion middleware, schema validation, CORS, and cookie helpers.",
};

export default function ApiDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "HTTP API" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Routes are files. Anything in yatta/backend is matched with a Next.js-style convention, and the parameter types come from the filename.">
        HTTP API
      </H1>

      <H2>File routing</H2>

      <CodeBlock
        title="convention"
        code={`yatta/backend/index.ts            →  GET /
yatta/backend/user/index.ts       →  /user
yatta/backend/posts/[id].ts       →  /posts/:id
yatta/backend/posts/[id]/index.ts →  /posts/:id
yatta/backend/users/[id]/posts.ts →  /users/:id/posts`}
      />

      <H2>A route</H2>

      <CodeBlock
        title="yatta/backend/user/index.ts"
        code={`import { API, createAPI } from "yatta.js/api";

const api = createAPI();

api.get(async (ctx) => {
  return API.json({ user: "ok" });
});

api.post(async (ctx) => {
  const body = await ctx.json();
  return API.json({ created: body }, { status: 201 });
});

export default api;`}
      />

      <H2>Dynamic routes</H2>

      <P>
        The filename types <Code>ctx.params</Code>. No casts, no runtime schema.
      </P>

      <CodeBlock
        title="yatta/backend/posts/[id].ts"
        code={`import { API, createAPI } from "yatta.js/api";

const api = createAPI();

api.get(async (ctx) => {
  const id = ctx.params.id;   // typed string
  return API.json({ id });
});

export default api;`}
      />

      <H2>Context</H2>

      <CodeBlock
        title="ctx"
        code={`ctx.req          // the Request
ctx.params       // typed from the filename
ctx.query()      // parsed query string
ctx.state        // bag for middleware to share values
ctx.headers      // request headers

await ctx.json();          // body as JSON
await ctx.formData();      // multipart or urlencoded
ctx.cookies();             // parsed cookies`}
      />

      <H2>Responses</H2>

      <CodeBlock
        title="API.*"
        code={`API.json({ ok: true });
API.json({ error: "Not found" }, { status: 404 });
API.text("plain");
API.redirect("/login");
API.stream(readableStream);

API.cookie("session", value, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: "7d",
});`}
      />

      <H2>Validation</H2>

      <P>
        Pass a schema to <Code>ctx.json</Code> or <Code>ctx.formData</Code>.
        Zod, Valibot and ArkType are all supported.
      </P>

      <CodeBlock
        title="Validation"
        code={`import { z } from "zod";

api.post(async (ctx) => {
  const body = await ctx.json(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  );

  return API.json({ ok: true, name: body.name });
});`}
      />

      <Note kind="warn">
        A validation failure throws <Code>ValidationError</Code>, which the
        router turns into a <Code>400</Code>. The underlying parser error is
        preserved on <Code>.cause</Code>.
      </Note>

      <H2>Middleware</H2>

      <P>
        Middleware wraps the handler. Call <Code>next()</Code> to continue; return
        a response to short-circuit.
      </P>

      <CodeBlock
        title="middleware"
        code={`api.use(async (ctx, next) => {
  const started = Date.now();

  const res = await next();

  console.log(\`\${ctx.req.method} \${ctx.params.id} \${Date.now() - started}ms\`);
  return res;
});

// Auth guard for everything below
api.use(async (ctx, next) => {
  const token = ctx.req.headers.get("Authorization")?.replace("Bearer ", "");
  const session = await auth.getSession(token);

  if (!session) return API.json({ error: "Unauthorized" }, { status: 401 });

  ctx.state.user = session.user;   // available downstream
  return next();
});`}
      />

      <Note>
        Calling <Code>next()</Code> twice in one middleware throws. This is
        caught deliberately rather than silently running the handler twice.
      </Note>

      <P>
        Outside production, the file-system router reloads at most twice a second so a
        <em>newly added</em> route file is served without a restart. Reloading on every
        request was both a directory scan per request and a race —{" "}
        <code>reload()</code> rewrites the route table while <code>match()</code> reads
        it — which on a fresh scaffold failed 40 of 100 concurrent requests to a
        file-routed path. An <em>edited</em> file is not re-read, because{" "}
        <code>import()</code> caches the module: use <code>bun run dev</code> for edits.
      </P>

      <H3>Rate limiting</H3>

      <CodeBlock
        title="rateLimit"
        code={`api.rateLimit({
  maxRequests: 100,
  windowMs: 60_000,           // per key; defaults to X-Forwarded-For, then one global bucket
  getKey: (ctx) => ctx.req.headers.get("x-api-key") ?? "global",
});

// → 429 with a Retry-After header once the bucket is over`}
      />

      <Callout>
        Both numbers are validated when the middleware is registered, and rejected if
        they are not finite and at least 1. The check is{" "}
        <code>count &gt; maxRequests</code>, and <code>count &gt; NaN</code> is false —
        so a <code>NaN</code> did not fail the limit, it <em>removed</em> it, and every
        request was answered 200. That is the likeliest way to produce one:{" "}
        <code>maxRequests: Number(process.env.RATE_MAX)</code> with the variable unset.
        <code>windowMs: 0</code> is rejected for the same reason by a different route —
        the bucket resets every millisecond, so the count never accumulates.
      </Callout>

      <H2>Errors</H2>

      <CodeBlock
        title="error handling"
        code={`import { HttpError, ValidationError } from "yatta.js/api";

// Throw with a status
throw new HttpError("Not found", 404);

// Catch everything
api.onError(async (err, ctx) => {
  console.error(err);

  if (err instanceof HttpError) {
    return API.json({ error: err.message }, { status: err.status });
  }

  return API.json({ error: "Internal Server Error" }, { status: 500 });
});`}
      />

      <H2>CORS</H2>

      <CodeBlock
        code={`api.cors({
  origin: ["https://app.dev", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  maxAge: 86_400,
});`}
      />

      <H2>Method not allowed</H2>

      <CodeBlock
        code={`api.get(handler);
api.post(handler);
api.put(handler);
api.patch(handler);
api.delete(handler);
api.all(handler);   // every method`}
      />

      <H2>Streaming</H2>

      <CodeBlock
        title="yatta/backend/stream.ts"
        code={`api.get(async () => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});`}
      />

      <DocFooter
        prev={{ href: "/docs/realtime", title: "Realtime" }}
        next={{ href: "/docs/types", title: "Typed keys" }}
      />
    </article>
  );
}
