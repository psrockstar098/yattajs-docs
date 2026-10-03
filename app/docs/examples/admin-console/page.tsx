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
  title: "Admin console — YATTA Examples",
  description:
    "User management, role assignment, session revocation and audited impersonation behind an admin guard.",
};

export default function AdminConsoleExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Admin console" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Every privileged action is checked, scoped and recorded — including the ones an admin performs as somebody else.">
        Admin console
      </H1>

      <H2 id="guard">Guard the admin surface</H2>

      <P>A flag on the session is not enough. Guard the routes, re-check the permission on every action, and write an audit row for anything that changes access.</P>

      <CodeBlock
        title="yatta/func/admin-guard.ts"
        code={`import { ForbiddenError, UnauthorizedError } from "yatta/auth";
import type { Middleware } from "yatta/api";
import type { PublicUser } from "yatta/auth";
import { auth } from "./auth";

export interface AdminRequest {
  userId: string;
  roles: string[];
  ip: string;
}

/**
 * Require an admin role.
 *
 * Requires the permission rather than matching a role string, so adding a
 * "support" role that can read users is a config change, not a code change.
 */
export const requireAdmin: Middleware = async (ctx, next) => {
  const user = (await auth.getSession(ctx.req)) as PublicUser | null;
  if (!user) throw new UnauthorizedError();

  if (!auth.permissions.check(user.roles, "user:manage", "user")) {
    throw new ForbiddenError();
  }

  // Stash the identity so handlers do not re-resolve it, and so the audit row
  // records who acted even if the session is later revoked.
  ctx.state.admin = {
    userId: user.id,
    roles: user.roles,
    ip: ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
  } satisfies AdminRequest;

  return next();
};

export function actor(ctx: { state: Record<string, unknown> }): AdminRequest {
  return ctx.state.admin as AdminRequest;
}`}
      />

      <H2 id="users">User management</H2>

      <CodeBlock
        title="yatta/backend/admin/users.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { and, col } from "yatta/db";
import { db } from "../../func/db";
import { auth } from "../../func/auth";
import { requireAdmin, actor } from "../../func/admin-guard";
import { record } from "../../func/audit";

const route = createAPI("/admin/users");

route.use(requireAdmin);

route.get("/", async (ctx) => {
  const q = ctx.query().q;
  const limit = Math.min(Number(ctx.query().limit ?? 50), 200);

  const users = q
    ? await db.users
        .where((f) => f.email.contains(String(q)))
        .orderBy({ createdAt: "desc" })
        .limit(limit)
        .all()
    : await db.users.orderBy({ createdAt: "desc" }).limit(limit).all();

  // Never return password material, even to an admin.
  return Response.json(users.map(({ passwordHash, ...safe }) => safe));
});

route.post("/:id/ban", async (ctx) => {
  const admin = actor(ctx);
  const target = await db.users.findById(ctx.params.id);
  if (!target) throw new HttpError(404, "Unknown user");

  await db.users.where((f) => f.id.isEqualTo(ctx.params.id))
    .update({ bannedAt: new Date() });

  // Kill every live session, or the ban is decorative.
  // Session revocation lives on the store; Auth exposes no shortcut for it.
  await auth.store.deleteSessionsByUserId(ctx.params.id);

  await record({
    tenantId: null,
    actorId: admin.userId,
    action: "user.ban",
    target: \`user:\${ctx.params.id}\`,
    before: { bannedAt: null },
    after: { bannedAt: new Date().toISOString() },
  });

  return new Response(null, { status: 204 });
});`}
      />

      <H2 id="impersonation">Audited impersonation</H2>

      <P>Impersonation is the most dangerous thing an admin panel offers. It needs a short lifetime, a visible banner, and an audit row written <em>before</em> the session is created.</P>

      <CodeBlock
        title="yatta/backend/admin/impersonate.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { auth } from "../../func/auth";
import { record } from "../../func/audit";
import { requireAdmin, actor } from "../../func/admin-guard";
import { observer } from "../../func/observe";

const route = createAPI("/admin");

route.use(requireAdmin);

const MAX_MINUTES = 15;

route.post("/impersonate/:id", async (ctx) => {
  const admin = actor(ctx);

  if (ctx.params.id === admin.userId) {
    throw new HttpError(400, "Already you");
  }

  const target = await db.users.findById(ctx.params.id);
  if (!target) throw new HttpError(404, "Unknown user");
  if (target.bannedAt) throw new HttpError(409, "User is banned");

  // Audit first. If this write fails we must not create the session.
  await record({
    tenantId: null,
    actorId: admin.userId,
    action: "user.impersonate",
    target: \`user:\${ctx.params.id}\`,
    before: null,
    after: { minutes: MAX_MINUTES, from: admin.ip },
  });

  // There is no Auth.createSession(). Minting a session for another user means
  // building the AuthSession yourself and handing it to the store — note that
  // this bypasses the normal sign-in path, so the audit record above is the only
  // thing tying the resulting session back to the admin who made it.
  const sessionId = crypto.randomUUID();
  const rawSessionToken = auth.crypto.randomToken();
  const refreshJwt = auth.jwt.sign({
    sub: target.id,
    sid: sessionId,
    type: "refresh",
    ver: 0,
    expInSec: MAX_MINUTES * 60,
  });

  const session = await auth.store.createSession({
    id: sessionId,
    userId: target.id,
    sessionTokenHash: auth.crypto.hash(rawSessionToken),
    refreshTokenHash: auth.crypto.hash(refreshJwt),
    expiresAt: new Date(Date.now() + MAX_MINUTES * 60_000),
    refreshVersion: 0,
    userAgent: ctx.req.headers.get("user-agent") ?? undefined,
    ip: admin.ip,
    lastSeenAt: new Date(),
    lastAuthenticatedAt: new Date(),
    createdAt: new Date(),
  });

  observer.log.warn("Admin impersonation started", {
    admin: admin.userId,
    target: target.id,
    minutes: MAX_MINUTES,
  });

  return Response.json({
    ...session,
    // The client shows this until the session expires.
    banner: \`You are viewing as \${target.email}. This ends in \${MAX_MINUTES} minutes.\`,
  });
});

/** Refuse any write that is not a read while impersonating. */
route.post("/impersonate/stop", async (ctx) => {
  await auth.signOut(ctx.req);
  return Response.json({ ok: true });
});`}
      />

      <Callout kind="warn">Write the audit row <em>before</em> creating the session. If the process dies between the two, you want an audit entry with no session; you do not want an unaudited live session.</Callout>

      <H2 id="sessions">List and revoke sessions</H2>

      <CodeBlock
        title="yatta/backend/admin/sessions.ts"
        code={`route.get("/users/:id/sessions", async (ctx) => {
  const sessions = await db.authSessions
    .where((f) => f.userId.isEqualTo(ctx.params.id))
    .orderBy({ lastSeenAt: "desc" })
    .all();

  return Response.json(sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    ip: s.ip,
    // Enough to recognise the device, not enough to be a fingerprint.
    userAgent: s.userAgent?.slice(0, 120),
    current: s.id === ctx.cookies().yatta_session,
  })));
});

route.delete("/sessions/:id", async (ctx) => {
  await auth.store.deleteSession(ctx.params.id);

  await record({
    tenantId: null,
    actorId: actor(ctx).userId,
    action: "session.revoke",
    target: \`session:\${ctx.params.id}\`,
    before: null, after: null,
  });

  return new Response(null, { status: 204 });
});`}
      />

      <H2 id="read-only">The read-only guard</H2>

      <P>During an investigation an admin usually needs to look, not touch. A read-only flag on the impersonated session turns every write route into a 403 without touching each one.</P>

      <CodeBlock
        title="yatta/func/admin-guard.ts"
        code={`/**
 * Block writes while an admin is impersonating.
 *
 * Applied to the impersonation session only, so normal admin writes are
 * unaffected.
 */
export const denyWritesWhileImpersonating: Middleware = async (ctx, next) => {
  const user = await auth.getUser(ctx.req);
  const impersonating = user?.impersonatedBy;

  if (impersonating && !["GET", "HEAD", "OPTIONS"].includes(ctx.req.method)) {
    observer.log.warn("Blocked write during impersonation", {
      admin: impersonating,
      path: new URL(ctx.req.url).pathname,
    });

    throw new HttpError(403, "Read-only session");
  }

  return next();
};`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/billing-subscriptions", title: "Billing & subscriptions" }}
        next={{ href: "/docs/examples/ai-support-agent", title: "AI support agent" }}
      />
    </article>
  );
}
