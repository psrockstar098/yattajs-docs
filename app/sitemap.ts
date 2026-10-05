import type { MetadataRoute } from "next";
import { apiModules } from "@/lib/api";

// Reference pages are generated from the framework source, so the module list
// comes from the same data the pages render from.
const referenceModules = apiModules;

/**
 * Sitemap for the public site. The docs index is the canonical entry point
 * for everything under /docs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://yatta.js.org";

  const pages = [
    { path: "/", priority: 1.0, frequency: "weekly" as const },
    { path: "/docs", priority: 0.9, frequency: "weekly" as const },
    { path: "/docs/quickstart", priority: 0.9, frequency: "monthly" as const },
    { path: "/docs/cli", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/layout", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/guides/email", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/guides/oauth", priority: 0.8, frequency: "monthly" as const },
    {
      path: "/docs/guides/auth-middleware",
      priority: 0.7,
      frequency: "monthly" as const,
    },
    { path: "/docs/guides/uploads", priority: 0.7, frequency: "monthly" as const },
    {
      path: "/docs/guides/background-work",
      priority: 0.7,
      frequency: "monthly" as const,
    },
    {
      path: "/docs/guides/production",
      priority: 0.7,
      frequency: "monthly" as const,
    },
    { path: "/docs/runtime", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/reliability", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/observe", priority: 0.9, frequency: "monthly" as const },
    { path: "/docs/db", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/auth", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/jobs", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/events", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/cache", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/storage", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/mail", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/realtime", priority: 0.7, frequency: "monthly" as const },
    { path: "/docs/api", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/client", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/frontend", priority: 0.8, frequency: "monthly" as const },
    { path: "/docs/types", priority: 0.6, frequency: "monthly" as const },
    { path: "/docs/config", priority: 0.6, frequency: "monthly" as const },
    { path: "/docs/deployment", priority: 0.6, frequency: "monthly" as const },
    { path: "/docs/guides/sessions", priority: 0.9, frequency: "monthly" as const },
    {
      path: "/docs/guides/permissions",
      priority: 0.8,
      frequency: "monthly" as const,
    },
    { path: "/docs/examples", priority: 0.9, frequency: "weekly" as const },
    {
      path: "/docs/examples/todo-api",
      priority: 0.8,
      frequency: "monthly" as const,
    },
    {
      path: "/docs/examples/image-pipeline",
      priority: 0.8,
      frequency: "monthly" as const,
    },
    {
      path: "/docs/examples/realtime-chat",
      priority: 0.8,
      frequency: "monthly" as const,
    },
    ...["multi-tenant", "webhook-relay", "audit-log", "feature-flags", "rate-limited-api", "search", "notification-hub", "cron-scheduler", "csv-import", "analytics", "billing-subscriptions", "admin-console", "ai-support-agent", "quota-enforcement", "incident-console", "fullstack-next"].map(
      (slug) => ({
        path: `/docs/examples/${slug}`,
        priority: 0.8,
        frequency: "monthly" as const,
      }),
    ),
    { path: "/docs/api-reference", priority: 0.8, frequency: "weekly" as const },
    ...referenceModules.map(({ slug }) => ({
      path: `/docs/api-reference/${slug}`,
      priority: 0.8,
      frequency: "weekly" as const,
    })),
  ];

  const lastModified = new Date();

  return pages.map(({ path, priority, frequency }) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: frequency,
    priority,
  }));
}
