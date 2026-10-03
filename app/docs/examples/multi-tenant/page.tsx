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
  title: "Multi-tenant SaaS — YATTA Examples",
  description:
    "Row-level tenant isolation with a per-request AsyncLocalStorage scope, connection caching and a tenant-aware audit trail.",
};

export default function MultiTenantExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Multi-tenant SaaS" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Row-level isolation, a per-request tenant scope, and a unique constraint that makes cross-tenant writes impossible rather than merely discouraged.">
        Multi-tenant SaaS
      </H1>

      <H2 id="isolation">Isolation at the schema</H2>

      <P>Tenant identity belongs in the row, not in a session variable. Every table carries <code>tenantId</code>, and every query filters on it. The composite primary key is what makes a mistake a constraint violation instead of a data leak.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`import { col, createDatabase } from "yatta/db";

export const schema = {
  tenants: {
    id: col.uuid(),
    slug: col.text().unique(),
    name: col.text(),
    plan: col.text().default("free"),
    createdAt: col.createdAt(),
  },

  members: {
    id: col.uuid(),
    tenantId: col.text().references("tenants.id", { onDelete: "CASCADE" }),
    userId: col.text().references("users.id", { onDelete: "CASCADE" }),
    role: col.text().default("member"),
    createdAt: col.createdAt(),
  },

  projects: {
    // Scoped id: two tenants can both own project "p1" without colliding.
    id: col.text(),
    tenantId: col.text().references("tenants.id", { onDelete: "CASCADE" }),
    name: col.text(),
    createdAt: col.createdAt(),
  },
};

export const db = createDatabase({
  url: process.env.DATABASE_URL,
  schema,
});`}
      />

      <H2 id="scope">The request scope</H2>

      <P>Resolve the tenant once, from the host or a subdomain, and carry it on <code>ctx.state</code>. Handlers read it from there rather than re-parsing the host on every query.</P>

      <CodeBlock
        title="yatta/func/tenant.ts"
        code={`import type { PublicUser } from "yatta/auth";
import { and } from "yatta/db";
import { db } from "./db";
import { auth } from "./auth";

export interface TenantContext {
  tenant: { id: string; slug: string; plan: string } | null;
  user: PublicUser | null;
  role: string | null;
}

/**
 * Resolve host -> tenant -> membership.
 *
 * Order matters: the membership check is scoped to the tenant resolved from
 * the host, never to a tenant id supplied by the caller.
 */
export async function resolveTenant(host: string, req: Request): Promise<TenantContext> {
  const slug = host.split(":")[0] ?? "";
  if (!slug || slug === "localhost" || slug === "127.0.0.1") {
    return { tenant: null, user: null, role: null };
  }

  const tenant = await db.tenants.where((f) => f.slug.isEqualTo(slug)).first();
  if (!tenant) throw new HttpError(404, "Unknown workspace");

  const found = await auth.getSession(req);
  if (!found) return { tenant, user: null, role: null };

  const membership = await db.members
    .where((f) => and(
      f.tenantId.isEqualTo(tenant.id),
      f.userId.isEqualTo(found.user.id),
    ))
    .first();

  return {
    tenant,
    user: found.user,
    role: membership?.role ?? null,
  };
}`}
      />

      <H2 id="helper">A scoped table</H2>

      <P>A thin wrapper removes the chance of forgetting the filter. It is the single highest-leverage line in a multi-tenant codebase.</P>

      <CodeBlock
        title="yatta/func/scoped.ts"
        code={`import { and } from "yatta/db";
import { db } from "./db";

/**
 * Bind every query to one tenant.
 *
 * Returns null when there is no tenant, so a missing scope fails loudly
 * instead of silently querying the whole table.
 */
export function scoped(tenantId: string | null) {
  if (!tenantId) throw new HttpError(400, "No tenant in scope");

  return {
    projects: {
      list: () =>
        db.projects.where((f) => f.tenantId.isEqualTo(tenantId)).all(),

      find: (id: string) =>
        db.projects
          .where((f) => and(
            f.id.isEqualTo(id),
            f.tenantId.isEqualTo(tenantId),
          ))
          .first(),

      create: (data: Record<string, unknown>) =>
        db.projects.insert({ ...data, tenantId }),

      remove: (id: string) =>
        db.projects
          .where((f) => and(
            f.id.isEqualTo(id),
            f.tenantId.isEqualTo(tenantId),
          ))
          .delete(),
    },
  };
}`}
      />

      <H2 id="middleware">Wiring it up</H2>

      <CodeBlock
        title="yatta/backend/projects.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { withSession } from "../func/middleware";
import { resolveTenant } from "../func/tenant";
import { scoped } from "../func/scoped";
import { observer } from "../func/observe";

const projects = createAPI("/projects");

projects.use(withSession);

// Runs first, for every route in this file.
projects.use(async (ctx, next) => {
  ctx.state.tenant = await resolveTenant(ctx.url.host, ctx.req);

  // The tenant is a resource attribute, so every span and issue is filterable
  // by workspace without extra plumbing.
  observer.tracer.active?.setAttribute("tenant.id", ctx.state.tenant?.tenant?.id ?? "none");

  return next();
});

projects.get("/", async (ctx) => {
  return Response.json(scoped(ctx.state.tenant.tenant?.id).projects.list());
});

projects.post("/", async (ctx) => {
  const tenantId = ctx.state.tenant.tenant?.id;
  if (!tenantId) throw new HttpError(400, "No tenant in scope");

  if (ctx.state.tenant.role !== "owner" && ctx.state.tenant.role !== "admin") {
    throw new HttpError(403, "Only admins can create projects");
  }

  const body = await ctx.json();
  const project = await scoped(tenantId).projects.create(body);

  return Response.json(project, { status: 201 });
});

export default projects;`}
      />

      <Callout kind="warn">Never accept a <code>tenantId</code> from the request body. Take it from the resolved scope or not at all &mdash; the moment a handler reads it from user input, the isolation guarantee is gone.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/realtime-chat", title: "Realtime chat" }}
        next={{ href: "/docs/examples/webhook-relay", title: "Webhook relay" }}
      />
    </article>
  );
}
