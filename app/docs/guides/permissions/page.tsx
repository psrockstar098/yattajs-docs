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
  title: "Roles and permissions — YATTA Docs",
  description:
    "Role-based access control in Yatta: defining roles, checking permissions in a route, ownership rules, and cycle detection.",
};

export default function PermissionsGuide() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Roles and permissions" },
        ]}
      />

      <H1
        eyebrow="Guides"
        sub="Checking a role string is not authorization. Roles describe who someone is; permissions describe what they may do to a specific resource."
      >
        Roles and permissions
      </H1>

      <H2 id="roles-vs-permissions">Roles versus permissions</H2>

      <P>
        A check like <code>user.roles.includes(&quot;admin&quot;)</code> answers the wrong
        question. It cannot express &ldquo;anyone signed in may edit their own comment, but only
        a moderator may delete someone else&rsquo;s&rdquo;.
        That needs permissions over a resource, with ownership as an input.
      </P>

      <CodeBlock
        title="yatta/func/permissions.ts"
        code={`import { auth } from "./auth";

export const roles = {
  user: {
    "post:create": ["*"],
    "post:update": ["own"],
    "post:delete": ["own"],
    "comment:create": ["*"],
  },
  moderator: {
    "post:update": ["*"],
    "post:delete": ["*"],
    "comment:delete": ["*"],
  },
  admin: {
    "post:*": ["*"],
    "comment:*": ["*"],
    "user:ban": ["*"],
  },
};

auth.permissions.initialize(roles);`}
      />

      <P>
        Each entry lists the scopes that grant the action. <code>&quot;*&quot;</code> means
        anything, <code>&quot;own&quot;</code> means only resources the user created, and
        the third argument to <code>check</code> tells it which of the two this
        particular record is.
      </P>

      <H2 id="checking">Checking a permission</H2>

      <CodeBlock
        code={`const allowed = auth.permissions.check(
  user.roles,        // string[]
  "post:update",     // the action
  "post",            // the resource
  post.authorId === user.id,   // isOwner
);

if (!allowed) {
  return route.json({ error: "Forbidden" }, { status: 403 });
}`}
      />

      <Callout kind="note">
        <code>check</code> takes the resource separately from the action, so{" "}
        <code>&quot;post:update&quot;</code> is not parsed for you. Pass both — that
        is what lets <code>post:*</code> in the admin role cover every action on
        posts without listing them.
      </Callout>

      <H2 id="middleware">Enforcing it in middleware</H2>

      <P>
        Writing the check inside every handler is how permission bugs get in.
        Put it in middleware so the rule is declared once and cannot be
        forgotten on the next route.
      </P>

      <CodeBlock
        title="yatta/func/auth-middleware.ts"
        code={`import { ForbiddenError, UnauthorizedError } from "yatta.js/auth";
import type { Middleware } from "yatta.js/api";
import { auth } from "./auth";
import { db } from "./db";

// Attaches ctx.state.user for every downstream middleware and handler.
export const withSession: Middleware = async (ctx, next) => {
  const found = await auth.getSession(ctx.req);
  ctx.state.user = found?.user ?? null;
  return next();
};

// Requires a signed-in user.
export const requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.state.user) throw new UnauthorizedError();
  return next();
};

// Requires a permission over a loaded resource.
export function requirePermission(
  action: string,
  resource: string,
  load: (ctx: never) => Promise<{ authorId: string }>,
): Middleware {
  return async (ctx, next) => {
    const user = ctx.state.user as PublicUser | null;
    if (!user) throw new UnauthorizedError();

    const record = await load(ctx as never);
    const isOwner = record.authorId === user.id;

    if (!auth.permissions.check(user.roles, action, resource, isOwner)) {
      throw new ForbiddenError();
    }

    return next();
  };
}`}
      />

      <H2 id="in-a-route">Using it in a route</H2>

      <CodeBlock
        title="yatta/backend/posts.ts"
        code={`import { createAPI } from "yatta.js/api";
import { db } from "../func/db";
import { auth } from "../func/auth";
import { requireAuth } from "../func/auth-middleware";
import type { PublicUser } from "yatta.js/auth";

const posts = createAPI("/posts");

posts.use(requireAuth);

posts.get("/", async (ctx) => {
  const rows = await db.posts.orderBy({ createdAt: "desc" }).all();
  return Response.json(rows);
});

posts.post("/", async (ctx) => {
  const user = ctx.state.user as PublicUser;
  const body = await ctx.json();

  const post = await db.posts.insert({ ...body, authorId: user.id });
  return Response.json(post, { status: 201 });
});

posts.delete("/:id", async (ctx) => {
  const user = ctx.state.user as PublicUser;

  const post = await db.posts.findById(ctx.params.id);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  if (!auth.permissions.check(
    user.roles, "post:delete", "post", post.authorId === user.id,
  )) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.posts.where((f) => f.id.isEqualTo(ctx.params.id)).delete();
  return new Response(null, { status: 204 });
});

export default posts;`}
      />

      <H2 id="cycles">Inheritance cycles</H2>

      <P>
        Roles can inherit from each other. <code>detectCycles</code> returns the
        offending chain rather than looping, so a bad config fails loudly at
        startup instead of hanging the first request that checks a permission.
      </P>

      <CodeBlock
        code={`const cycle = auth.permissions.detectCycles(roles);
if (cycle) {
  throw new Error(\`Circular role inheritance: \${cycle.join(" → ")}\`);
}`}
      />

      <Callout kind="tip">
        Call <code>detectCycles</code> once at boot rather than per request. It
        reads a config that does not change at runtime, so the answer cannot.
      </Callout>

      <DocFooter
        prev={{ href: "/docs/guides/sessions", title: "Sessions" }}
        next={{ href: "/docs/api-reference/auth", title: "yatta/auth" }}
      />
    </article>
  );
}
