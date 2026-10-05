import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1, H2, P, Code, Note, DocFooter, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Protect a route — YATTA Docs",
  description:
    "Require a session on a route, attach the user, and check roles — with middleware and a reusable helper.",
};


export default function AuthMiddlewareGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Protect a route" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="A session token, one middleware call, and role checks. This is the pattern to copy into a new project.">
        Protect a route
      </H1>

      <H2 id="resolve-the-session">Resolve the session</H2>

      <P>
        <Code>auth.getSession</Code> takes the raw token and returns the user, or{" "}
        <Code>null</Code> when it is missing or expired. Tokens arrive either in
        a cookie or as a bearer header.
      </P>

      <CodeBlock
        title="yatta/func/session.ts"
        code={`import type { AuthSession } from "yatta.js/auth";
import { auth } from "./auth";

/** Reads the session from the Authorization header, or the cookie. */
export async function getSession(req: Request): Promise<AuthSession | null> {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "");
  const cookie = readCookie(req.headers.get("Cookie"), "session");

  return auth.getSession(bearer ?? cookie);
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}`}
      />

      <H2 id="require-auth">Require auth on one route</H2>

      <CodeBlock
        title="yatta/backend/me.ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { getSession } from "../func/session";

const api = createAPI();

api.get(async (ctx) => {
  const session = await getSession(ctx.req);

  if (!session) {
    return API.json({ error: "Unauthorized" }, { status: 401 });
  }

  return API.json({ user: session.user });
});

export default api;`}
      />

      <H2 id="require-auth-everywhere">Require auth everywhere</H2>

      <P>
        Middleware runs before every handler in the same file. Return early to
        short-circuit.
      </P>

      <CodeBlock
        title="yatta/backend/dashboard/index.ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { getSession } from "../../func/session";

const api = createAPI();

// Applies to every route in this file.
api.use(async (ctx, next) => {
  const session = await getSession(ctx.req);

  if (!session) {
    // Send browsers to a login page; APIs get a 401.
    if (ctx.req.headers.get("accept")?.includes("text/html")) {
      return Response.redirect("/login", 302);
    }
    return API.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shared with handlers below.
  ctx.state.session = session;

  return next();
});

api.get(async (ctx) => {
  return API.json({ user: ctx.state.session.user });
});

export default api;`}
      />

      <Note>
        <Code>ctx.state</Code> is a plain bag for middleware to pass values
        downstream. It is typed loosely, so give <Code>ctx.state.session</Code> a
        known shape at the top of the file.
      </Note>

      <H2 id="check-roles">Check roles</H2>

      <P>
        Users carry a <Code>roles</Code> array. The permission helper in{" "}
        <a href="/docs/auth" className="underline underline-offset-4">
          Authentication
        </a>{" "}
        checks a role or a full permission string.
      </P>

      <CodeBlock
        title="roles"
        code={`const { user } = ctx.state.session;

// simple role check
if (!user.roles.includes("admin")) {
  return API.json({ error: "Forbidden" }, { status: 403 });
}

// permission check, if you configured roles
const allowed = auth.permissions.check(user.roles, "delete", "posts");

// ownership: only the author may edit their own post
if (post.authorId !== user.id && !user.roles.includes("admin")) {
  return API.json({ error: "Forbidden" }, { status: 403 });
}`}
      />

      <P>Put the check in middleware when every route needs the same role:</P>

      <CodeBlock
        title="admin-only"
        code={`api.use(async (ctx, next) => {
  const session = await getSession(ctx.req);
  if (!session) return API.json({ error: "Unauthorized" }, { status: 401 });

  if (!session.user.roles.includes("admin")) {
    return API.json({ error: "Forbidden" }, { status: 403 });
  }

  ctx.state.user = session.user;
  return next();
});`}
      />

      <H2 id="set-cookies">Setting the session cookie</H2>

      <P>
        Login and OAuth both return <Code>cookies</Code> and a{" "}
        <Code>toResponse</Code> helper that sets them for you.
      </P>

      <CodeBlock
        title="yatta/backend/login.ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { auth } from "../func/auth";

const api = createAPI();

api.post(async (ctx) => {
  const { email, password } = await ctx.json();

  const result = await auth.signIn({ email, password, req: ctx.req });

  // Sets the HttpOnly session cookie and returns the user.
  return result.toResponse();
});

export default api;`}
      />

      <H2 id="csrf">CSRF</H2>

      <P>
        The session cookie is <Code>HttpOnly</Code>, so JavaScript cannot read
        it. For cookie-authenticated state-changing requests, check the{" "}
        <Code>Origin</Code> header as well.
      </P>

      <CodeBlock
        title="origin check"
        code={`const SAFE = new Set(["https://yourdomain.com", "http://localhost:4000"]);

api.post(async (ctx) => {
  const origin = ctx.req.headers.get("Origin");
  if (origin && !SAFE.has(origin)) {
    return API.json({ error: "Forbidden origin" }, { status: 403 });
  }

  // …
});`}
      />

      <Note>
        <Code>SameSite=Lax</Code> (the default on issued cookies) already blocks
        cross-site POSTs from other origins. The Origin check is cheap insurance,
        not a replacement.
      </Note>

      <DocFooter
        prev={{ href: "/docs/guides/oauth", title: "Sign in with Google & GitHub" }}
        next={{ href: "/docs/guides/uploads", title: "Upload files" }}
      />
    </article>
  );
}
