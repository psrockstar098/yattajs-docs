import type { Metadata } from "next";
import Link from "next/link";
import { H1, P, Callout, Breadcrumb, DocFooter } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Examples — YATTA Docs",
  description:
    "Eighteen complete Yatta projects: auth, multi-tenancy, uploads, realtime, webhooks, audit logs, search, notifications, analytics and more.",
};

const PROJECTS = [
  {
    slug: "todo-api",
    title: "Todo API",
    tagline: "Auth, CRUD, caching",
    body: "Session middleware, per-user data isolation, validated bodies, cursor pagination, a cache in front of a hot read, and a job that sends the daily digest.",
    teaches: [
      "Session middleware and ownership checks",
      "Validating a JSON body",
      "Cache-aside with tags",
      "Fan-out work onto a queue",
    ],
  },
  {
    slug: "image-pipeline",
    title: "Image pipeline",
    tagline: "Uploads, storage, workers",
    body: "An upload that returns immediately. The request validates and stores the original, then a worker resizes it, emits an event, and pushes progress to the browser over SSE.",
    teaches: [
      "Streaming an upload to a disk",
      "Reporting progress from inside a job",
      "Emitting an event the UI is listening for",
      "Streaming progress to the client",
    ],
  },
  {
    slug: "realtime-chat",
    title: "Realtime chat",
    tagline: "WebSockets, rooms, presence",
    body: "A chat server where joining a room is permission-checked, presence is tracked per room, and messages fan out through rooms rather than a global broadcast.",
    teaches: [
      "Authorising a socket join",
      "Scoping broadcasts to a room",
      "Tracking presence without a database write",
      "Reconnecting clients cleanly",
    ],
  },
  {
    slug: "multi-tenant",
    title: "Multi-tenant SaaS",
    tagline: "Tenant isolation, scopes",
    body: "Row-level isolation with a per-request tenant scope, a scoped table wrapper that removes the chance of forgetting the filter, and tenant id attached to every span.",
    teaches: [
      "Resolving tenant from the host",
      "A scoped query helper",
      "Roles per workspace",
      "Tenant as a span attribute",
    ],
  },
  {
    slug: "webhook-relay",
    title: "Webhook relay",
    tagline: "Signing, retries, dead letters",
    body: "Outbound webhooks that survive a flaky consumer: HMAC over the raw bytes, exponential backoff, and a dead-letter state for endpoints that will never recover.",
    teaches: [
      "Signing and verifying with HMAC",
      "Constant-time signature comparison",
      "Distinguishing 4xx from 5xx on retry",
      "Replaying a dead-letter queue",
    ],
  },
  {
    slug: "audit-log",
    title: "Audit log",
    tagline: "Hash chaining, verification",
    body: "An append-only trail where each row commits to the previous one, so deleting or editing a record breaks every link after it and a verifier proves it.",
    teaches: [
      "Stable canonical JSON serialisation",
      "Chained hashes",
      "Detecting a tampered or deleted row",
      "Storing diffs instead of whole rows",
    ],
  },
  {
    slug: "search",
    title: "Full-text search",
    tagline: "Full-text search",
    body: "FTS5 with a synchronised index, ranked results, and a cache that does not go stale. The index is maintained by triggers, so nothing can write without it.",
    teaches: [
      "FTS5 with triggers",
      "Ranking and snippets",
      "Cached queries",
      "Rebuildable index",
    ],
  },
  {
    slug: "feature-flags",
    title: "Feature flags",
    tagline: "Typed flags, live updates",
    body: "Flags declared once so a rename is a type error, read through a singleflight cache, overridable per user, and pushed to open browsers over a socket.",
    teaches: [
      "A typed flag set",
      "Singleflight flag reads",
      "Tag-based invalidation",
      "Server hydration to avoid a flash",
    ],
  },
  {
    slug: "rate-limited-api",
    title: "Rate-limited API",
    tagline: "Sliding window, tiers",
    body: "A limiter that counts inside a single statement so concurrent requests cannot both slip past the limit, with honest Retry-After values and per-key tiers.",
    teaches: [
      "Atomic increments",
      "Retry-After and RateLimit headers",
      "Per-key instead of per-IP limits",
      "Expiring the counter table",
    ],
  },
  {
    slug: "notification-hub",
    title: "Notification hub",
    tagline: "One intent, many channels",
    body: "Call sites declare an intent; the hub routes it to email, in-app and realtime according to per-user preferences, and batches digests overnight.",
    teaches: [
      "One intent, many channels",
      "Per-user preferences",
      "Digest batching",
      "Live unread badge",
    ],
  },
  {
    slug: "cron-scheduler",
    title: "Cron scheduler",
    tagline: "Overlap locking, jitter",
    body: "Scheduled jobs that do not double-run, do not stampede, and survive a restart. Leases are taken in the same statement that reads them.",
    teaches: [
      "Overlap locking",
      "Jitter",
      "Misfire handling",
      "Timezone buckets",
    ],
  },
  {
    slug: "csv-import",
    title: "CSV import",
    tagline: "Streaming, batching, progress",
    body: "A 400MB file that never enters memory, never blocks a request, and reports progress while it runs. Includes a dry run so you see the problems before committing.",
    teaches: [
      "Streaming parser",
      "Batched writes",
      "Progress reporting",
      "Dry run first",
    ],
  },
  {
    slug: "analytics",
    title: "Product analytics",
    tagline: "Events, rollups, funnels",
    body: "Event recording on a queue so it never sits on the request path, with daily rollups that keep queries fast as the raw table grows.",
    teaches: [
      "Non-blocking capture",
      "Daily rollups",
      "Idempotent aggregation",
      "Funnels",
    ],
  },
  {
    slug: "billing-subscriptions",
    title: "Billing & subscriptions",
    tagline: "Billing & subscriptions",
    body:
      "Plans, proration, idempotent webhooks, dunning, and usage metering that survives a retry.",
    teaches: [
      "Money in minor units",
      "Proration maths",
      "Idempotent charges",
      "Dunning sequence",
    ],
  },
  {
    slug: "admin-console",
    title: "Admin console",
    tagline: "Admin console",
    body:
      "User management, session revocation, and audited impersonation behind a permission guard.",
    teaches: [
      "Permission-guarded routes",
      "Audited impersonation",
      "Session revocation",
      "Read-only mode",
    ],
  },
  {
    slug: "ai-support-agent",
    title: "AI support agent",
    tagline: "AI support agent",
    body:
      "A tool-calling agent with full tracing, token and cost accounting, and a hard budget cap.",
    teaches: [
      "Tools as child spans",
      "Argument validation",
      "Cost caps",
      "Human handoff",
    ],
  },
  {
    slug: "quota-enforcement",
    title: "Quota enforcement",
    tagline: "Quota enforcement",
    body:
      "Per-plan quotas with soft and hard limits, predictive warnings, and usage headers.",
    teaches: [
      "Atomic counting",
      "Soft vs hard limits",
      "Predictive exhaustion",
      "Quota headers",
    ],
  },
  {
    slug: "incident-console",
    title: "Incident console",
    tagline: "Incident console",
    body:
      "The on-call console you would otherwise write by hand, assembled from the framework's own tracing.",
    teaches: [
      "Issue queue and triage",
      "Trace waterfall",
      "Deploy correlation",
      "Alerting on edges",
    ],
  },
  {
    slug: "fullstack-next",
    title: "Full-stack Next.js app",
    tagline: "Every subsystem, one project",
    body:
      "All of Yatta behind a Next.js frontend: auth, database, jobs, events, storage, mail, cache, realtime and observability, with one trace spanning both.",
    teaches: [
      "CORS with credentials",
      "Session auth from React",
      "SSE progress into state",
      "Feedback tied to a trace",
    ],
  },
];

export default function ExamplesIndex() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[{ label: "Docs", href: "/docs" }, { label: "Examples" }]}
      />

      <H1
        eyebrow="Examples"
        sub="Nineteen complete projects, written the way you would actually write them — including the parts that are usually left out."
      >
        Examples
      </H1>

      <P>
        The reference tells you what exists. These show how it fits together.
        Each one is a working file layout you can copy into{" "}
        <code>yatta/backend/</code> and run.
      </P>

      <Callout kind="note">
        Every snippet here was written against the current API. If you copy one
        and it does not compile, that is a bug in the docs — check the{" "}
        <Link href="/docs/api-reference" className="underline underline-offset-4">
          API reference
        </Link>{" "}
        signature before assuming the code is wrong.
      </Callout>

      <ul className="mt-8 space-y-3">
        {PROJECTS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/docs/examples/${p.slug}`}
              className="group block rounded-lg border border-[#f3eed7]/10 px-5 py-4 transition-colors hover:border-[#f3eed7]/20 hover:bg-[#f3eed7]/[0.03]"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-mono text-[15px] font-semibold text-[#f3eed7]">
                  {p.title}
                </h2>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#f3eed7]/35">
                  {p.tagline}
                </span>
              </div>

              <p className="mt-2 text-[14px] leading-[1.65] text-[#f3eed7]/55">
                {p.body}
              </p>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {p.teaches.map((t) => (
                  <li
                    key={t}
                    className="rounded border border-[#f3eed7]/10 px-2 py-0.5 font-mono text-[11px] text-[#f3eed7]/40"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>

      <DocFooter next={{ href: "/docs/examples/todo-api", title: "Todo API" }} />
    </article>
  );
}
