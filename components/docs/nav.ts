// components/docs/nav.ts
//
// Single source of truth for the docs rail. Adding a page means adding one
// entry here — the icon, the label, and the blurb all live together.
//
// Icons are Lucide (via react-icons), matching the rest of this site.

import type { IconType } from "react-icons";
import {
  LuActivity,
  LuBraces,
  LuBookOpen,
  LuBox,
  LuBoxes,
  LuClock,
  LuCompass,
  LuContainer,
  LuCpu,
  LuDatabase,
  LuFolderTree,
  LuGauge,
  LuGithub,
  LuKeyRound,
  LuLayers,
  LuHardDrive,
  LuListTodo,
  LuLock,
  LuMail,
  LuPackage,
  LuRadio,
  LuRocket,
  LuServer,
  LuSettings,
  LuShieldCheck,
  LuTerminal,
  LuUpload,
  LuWaypoints,
  LuWorkflow,
  LuZap,
} from "react-icons/lu";
import { apiModules } from "@/lib/api";

export interface NavItem {
  title: string;
  href: string;
  /** One-line summary shown on hover / under the heading. */
  blurb?: string;
  icon: IconType;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export { apiModules };

/** One icon per generated reference module, keyed by slug. */
const MODULE_ICONS: Record<string, IconType> = {
  root: LuPackage,
  runtime: LuCpu,
  api: LuWorkflow,
  otel: LuActivity,
  observe: LuGauge,
  db: LuDatabase,
  auth: LuLock,
  jobs: LuListTodo,
  cache: LuZap,
  storage: LuHardDrive,
  mail: LuMail,
  realtime: LuRadio,
  grpcweb: LuWorkflow,
  webdav: LuHardDrive,
  webfinger: LuCompass,
  doh: LuServer,
  oauth: LuKeyRound,
  oidc: LuShieldCheck,
  mcp: LuWorkflow,
};

export const docsNav: NavSection[] = [
  {
    title: "Getting started",
    items: [
      {
        title: "Introduction",
        href: "/docs",
        blurb: "What Yatta is and how the pieces fit together.",
        icon: LuCompass,
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        blurb: "Install, scaffold, and run your first route.",
        icon: LuRocket,
      },
      {
        title: "Install & CLI",
        href: "/docs/cli",
        blurb: "yatta init, link, and the project layout it creates.",
        icon: LuTerminal,
      },
      {
        title: "Project layout",
        href: "/docs/layout",
        blurb: "What lives in yatta/ and what you are meant to edit.",
        icon: LuFolderTree,
      },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        title: "Sessions",
        href: "/docs/guides/sessions",
        blurb:
          "The whole lifecycle: sign up, sign in, resolve, refresh, sign out.",
        icon: LuKeyRound,
      },
      {
        title: "Roles and permissions",
        href: "/docs/guides/permissions",
        blurb: "RBAC with ownership, enforced once in middleware.",
        icon: LuShieldCheck,
      },
      {
        title: "Send real email",
        href: "/docs/guides/email",
        blurb: "From terminal output to a verified Resend or SMTP setup.",
        icon: LuMail,
      },
      {
        title: "Sign in with Google & GitHub",
        href: "/docs/guides/oauth",
        blurb: "OAuth 2.0 with PKCE, plus account linking.",
        icon: LuGithub,
      },
      {
        title: "Protect a route",
        href: "/docs/guides/auth-middleware",
        blurb: "Require a session, and check roles.",
        icon: LuShieldCheck,
      },
      {
        title: "Upload files",
        href: "/docs/guides/uploads",
        blurb: "Validate, store, and serve user uploads.",
        icon: LuUpload,
      },
      {
        title: "Send email from a job",
        href: "/docs/guides/background-work",
        blurb: "Keep slow work off the request path.",
        icon: LuClock,
      },
      {
        title: "Go to production",
        href: "/docs/guides/production",
        blurb: "Secrets, Docker, probes, and the checklist.",
        icon: LuServer,
      },
    ],
  },
  {
    title: "The runtime",
    items: [
      {
        title: "Worker runtime",
        href: "/docs/runtime",
        blurb: "CPU and I/O pools, subsystems, and execution deadlines.",
        icon: LuCpu,
      },
      {
        title: "Reliability",
        href: "/docs/reliability",
        blurb: "Crash supervision, task deadlines, graceful draining.",
        icon: LuActivity,
      },
      {
        title: "Observability",
        href: "/docs/observe",
        blurb: "Traces, APM, metrics, errors, profiling and a dashboard.",
        icon: LuGauge,
      },
    ],
  },
  {
    title: "Engines",
    items: [
      {
        title: "Database",
        href: "/docs/db",
        blurb: "The typed SQLite ORM: schema, relations, queries.",
        icon: LuDatabase,
      },
      {
        title: "Authentication",
        href: "/docs/auth",
        blurb: "Passwords, sessions, passkeys, 2FA, API keys.",
        icon: LuLock,
      },
      {
        title: "Job queue",
        href: "/docs/jobs",
        blurb: "Durable background work: leases, retries, dead letters, cron.",
        icon: LuListTodo,
      },
      {
        title: "Events",
        href: "/docs/events",
        blurb: "A typed event bus that pipes straight into jobs.",
        icon: LuWaypoints,
      },
      {
        title: "Cache",
        href: "/docs/cache",
        blurb: "L1 memory + SQLite L2, singleflight, and SWR.",
        icon: LuZap,
      },
      {
        title: "Storage",
        href: "/docs/storage",
        blurb: "Local and S3 disks, uploads, signed URLs, streaming.",
        icon: LuHardDrive,
      },
      {
        title: "Mail",
        href: "/docs/mail",
        blurb: "Templates, layouts, and transports.",
        icon: LuMail,
      },
      {
        title: "Realtime",
        href: "/docs/realtime",
        blurb: "WebSockets, SSE, pub/sub, and AI streaming.",
        icon: LuRadio,
      },
      {
        title: "HTTP API",
        href: "/docs/api",
        blurb: "File-based routing, middleware, and validation.",
        icon: LuWorkflow,
      },
    ],
  },
  {
    title: "Roadmap",
    items: [
      {
        title: "Rate limiting",
        href: "/docs/rate-limit",
        blurb: "Per-key limits with a sliding window, enforced in middleware.",
        icon: LuGauge,
      },
      {
        title: "Cache decorator & edge purge",
        href: "/docs/cache-decorator",
        blurb: "Cache a function result and purge it from the edge.",
        icon: LuZap,
      },
      {
        title: "Auto-migrations",
        href: "/docs/migrate-generate",
        blurb: "Generate migrations from your schema diff.",
        icon: LuDatabase,
      },
      {
        title: "Transactional outbox",
        href: "/docs/outbox",
        blurb: "Reliable delivery: write the event in the same transaction.",
        icon: LuWaypoints,
      },
      {
        title: "Shared change log",
        href: "/docs/shared-change-log",
        blurb: "One ordered log every feature reads from.",
        icon: LuListTodo,
      },
      {
        title: "Full-text search",
        href: "/docs/full-text-search",
        blurb: "FTS5 search with ranking and snippets.",
        icon: LuCompass,
      },
      {
        title: "Time series",
        href: "/docs/time-series",
        blurb: "Append-only measurements with rollups.",
        icon: LuActivity,
      },
      {
        title: "Standalone binary",
        href: "/docs/standalone-build",
        blurb: "Ship one binary with no Bun installed.",
        icon: LuPackage,
      },
      {
        title: "Cloud backups",
        href: "/docs/cloud-backups",
        blurb: "Encrypted, scheduled backups to object storage.",
        icon: LuHardDrive,
      },
      {
        title: "Storage tiering",
        href: "/docs/storage-tiering",
        blurb: "Move cold files to cheap storage automatically.",
        icon: LuLayers,
      },
      {
        title: "Vector search",
        href: "/docs/vector-search",
        blurb: "Similarity search over embeddings, with a SQL fallback.",
        icon: LuBraces,
      },
      {
        title: "Profiler",
        href: "/docs/profiler",
        blurb: "A sampling profiler for hot paths.",
        icon: LuCpu,
      },
      {
        title: "Message bus",
        href: "/docs/message-bus",
        blurb: "Durable delivery across a cluster of nodes.",
        icon: LuRadio,
      },
      {
        title: "Time-travel replay",
        href: "/docs/time-travel-replay",
        blurb: "Rewind dev state to any snapshot.",
        icon: LuClock,
      },
      {
        title: "Replication",
        href: "/docs/replication",
        blurb: "Primary plus async read replicas.",
        icon: LuBoxes,
      },
      {
        title: "Raft consensus",
        href: "/docs/raft",
        blurb: "Leader election and log consistency.",
        icon: LuShieldCheck,
      },
    ],
  },
  {
    title: "Protocols",
    items: [
      {
        title: "Overview",
        href: "/docs/protocols",
        blurb: "Six protocols already listening, and what each one refuses.",
        icon: LuLayers,
      },
      {
        title: "WebDAV",
        href: "/docs/protocols/webdav",
        blurb: "File operations over HTTP, backed by storage.",
        icon: LuHardDrive,
      },
      {
        title: "gRPC-Web",
        href: "/docs/protocols/grpc-web",
        blurb: "Browser calls with protobuf framing.",
        icon: LuWorkflow,
      },
      {
        title: "DNS over HTTPS",
        href: "/docs/protocols/doh",
        blurb: "DNS questions over HTTPS.",
        icon: LuServer,
      },
      {
        title: "WebFinger",
        href: "/docs/protocols/webfinger",
        blurb: "acct: lookups with JRD answers.",
        icon: LuCompass,
      },
      {
        title: "OAuth 2.0 server",
        href: "/docs/protocols/oauth-server",
        blurb: "Be the login server: code, PKCE, refresh tokens.",
        icon: LuKeyRound,
      },
      {
        title: "OpenID Connect",
        href: "/docs/protocols/openid-connect",
        blurb: "Discovery, ID tokens, JWKS, userinfo.",
        icon: LuShieldCheck,
      },
      {
        title: "MCP server",
        href: "/docs/protocols/mcp",
        blurb: "Tools from your collections and functions, on /mcp.",
        icon: LuWorkflow,
      },
    ],
  },
  {
    title: "Extending",
    items: [
      {
        title: "Typed keys",
        href: "/docs/types",
        blurb: "Declaration merging for jobs, events, mail, and storage.",
        icon: LuBraces,
      },
      {
        title: "Configuration",
        href: "/docs/config",
        blurb: "Environment variables, health probes, and headers.",
        icon: LuSettings,
      },
      {
        title: "Deployment",
        href: "/docs/deployment",
        blurb: "Docker, cluster mode, and production checklist.",
        icon: LuContainer,
      },
    ],
  },
  {
    title: "API reference",
    items: [
      {
        title: "Overview",
        href: "/docs/api-reference",
        blurb:
          "Every exported symbol and method, generated from the framework source.",
        icon: LuBookOpen,
      },
      // One entry per module, so every page is reachable from the rail rather
      // than only through search. Generated, not hand-maintained.
      ...apiModules.map((m) => ({
        title: m.label,
        href: `/docs/api-reference/${m.slug}`,
        blurb: m.blurb,
        icon: MODULE_ICONS[m.slug] ?? LuBox,
      })),
    ],
  },
  {
    title: "Examples",
    items: [
      {
        title: "All examples",
        href: "/docs/examples",
        blurb: "Complete projects you can copy into yatta/backend/.",
        icon: LuBoxes,
      },
      {
        title: "Todo API",
        href: "/docs/examples/todo-api",
        blurb: "Auth, CRUD, ownership, caching, and a digest job.",
        icon: LuListTodo,
      },
      {
        title: "Image pipeline",
        href: "/docs/examples/image-pipeline",
        blurb: "Upload returns fast; a worker resizes and streams progress.",
        icon: LuHardDrive,
      },
      {
        title: "Realtime chat",
        href: "/docs/examples/realtime-chat",
        blurb: "Permission-checked rooms, presence, and socket validation.",
        icon: LuRadio,
      },
      {
        title: "Multi-tenant SaaS",
        href: "/docs/examples/multi-tenant",
        blurb: "Row-level isolation with a per-request tenant scope.",
        icon: LuBoxes,
      },
      {
        title: "Webhook relay",
        href: "/docs/examples/webhook-relay",
        blurb: "HMAC signing, exponential backoff, dead letters.",
        icon: LuWaypoints,
      },
      {
        title: "Audit log",
        href: "/docs/examples/audit-log",
        blurb: "An append-only trail where tampering is detectable.",
        icon: LuShieldCheck,
      },
      {
        title: "Feature flags",
        href: "/docs/examples/feature-flags",
        blurb: "Typed flags, cached reads, live updates over a socket.",
        icon: LuBraces,
      },
      {
        title: "Rate-limited API",
        href: "/docs/examples/rate-limited-api",
        blurb: "Atomic sliding-window counting and per-key tiers.",
        icon: LuGauge,
      },
      {
        title: "Full-text search",
        href: "/docs/examples/search",
        blurb: "FTS5 with triggers, ranked results and snippet highlighting.",
        icon: LuFolderTree,
      },
      {
        title: "Notification hub",
        href: "/docs/examples/notification-hub",
        blurb: "One intent routed to email, in-app and realtime, with per-user preferences and digest batching.",
        icon: LuMail,
      },
      {
        title: "Cron scheduler",
        href: "/docs/examples/cron-scheduler",
        blurb: "Scheduled jobs with atomic lease-based overlap locking, jitter and misfire handling.",
        icon: LuClock,
      },
      {
        title: "CSV import",
        href: "/docs/examples/csv-import",
        blurb: "A large CSV that never enters memory, never blocks a request, and reports progress while it runs.",
        icon: LuBoxes,
      },
      {
        title: "Product analytics",
        href: "/docs/examples/analytics",
        blurb: "Event recording on a queue, with daily rollups so queries stay fast as raw data grows.",
        icon: LuGauge,
      },
      {
        title: "Billing & subscriptions",
        href: "/docs/examples/billing-subscriptions",
        blurb:
          "Plans, proration, idempotent webhooks, dunning, and usage metering that survives a retry.",
        icon: LuGauge,
      },
      {
        title: "Admin console",
        href: "/docs/examples/admin-console",
        blurb:
          "User management, session revocation, and audited impersonation behind a permission guard.",
        icon: LuShieldCheck,
      },
      {
        title: "AI support agent",
        href: "/docs/examples/ai-support-agent",
        blurb:
          "A tool-calling agent with full tracing, token and cost accounting, and a hard budget cap.",
        icon: LuBraces,
      },
      {
        title: "Quota enforcement",
        href: "/docs/examples/quota-enforcement",
        blurb:
          "Per-plan quotas with soft and hard limits, predictive warnings, and usage headers.",
        icon: LuActivity,
      },
      {
        title: "Incident console",
        href: "/docs/examples/incident-console",
        blurb:
          "The on-call console you would otherwise write by hand, assembled from the framework's own tracing.",
        icon: LuCpu,
      },
      {
        title: "Full-stack Next.js app",
        href: "/docs/examples/fullstack-next",
        blurb:
          "Every subsystem behind a Next.js frontend, with one trace spanning both.",
        icon: LuLayers,
      },
    ],
  },
];
