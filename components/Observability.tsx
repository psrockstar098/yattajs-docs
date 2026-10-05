"use client";

import React, { useMemo, useState } from "react";

/**
 * Shipped or not.
 *
 * Every card states which it is. A feature marked "Planned" is on the roadmap
 * and does not exist in the framework today — the badge is load-bearing, not
 * decoration, so removing one means the feature actually shipped.
 */
type Status = "available" | "planned";

interface Feature {
  title: string;
  description: string;
  status: Status;
}

interface Group {
  id: string;
  label: string;
  heading: string;
  summary: string;
  features: Feature[];
}

const groups: Group[] = [
  {
    id: "tracing",
    label: "Tracing",
    heading: "Follow every request",
    summary:
      "Every inbound request becomes a trace that follows the work it caused — through your database, your cache, your queues and your dependencies.",
    features: [
      {
        title: "Trace requests end to end",
        description:
          "Trace every request across services, jobs and dependencies to see exactly where time is spent and where things go wrong.",
        status: "available",
      },
      {
        title: "Zero-touch instrumentation",
        description:
          "Attach your subsystems once and every query, login and job execution is traced. No manual span wiring at any call site.",
        status: "available",
      },
      {
        title: "Find the real bottleneck",
        description:
          "See every step of a request with self time and total time per span, so you know exactly where latency comes from.",
        status: "available",
      },
      {
        title: "CPU profiles with self time",
        description:
          "Profile any region with the V8 inspector and read self time per function, down to the file and line that held the CPU.",
        status: "planned",
      },
      {
        title: "Server-Timing headers",
        description:
          "Every response carries where its time went in a standard header your browser devtools already understand.",
        status: "available",
      },
      {
        title: "Turn a trace into a prompt",
        description:
          "Turn a failing trace into a self-contained prompt — or connect your coding agent directly via MCP, with the stack, source, timings and logs it needs.",
        status: "planned",
      },
    ],
  },
  {
    id: "errors",
    label: "Errors",
    heading: "Turn errors into action",
    summary:
      "Identical failures collapse into a single defect, so you fix the bug rather than sorting through thousands of occurrences.",
    features: [
      {
        title: "Group errors into defects",
        description:
          "Automatically group identical failures into one issue, keyed by a normalized message and the top application frame.",
        status: "available",
      },
      {
        title: "Errors with source code",
        description:
          "See the failing file and line, the full stack, and the breadcrumbs that led there — without checking out the build yourself.",
        status: "available",
      },
      {
        title: "Users and requests affected",
        description:
          "Every issue carries the users and requests it happened to, so you can tell a one-off from an outage.",
        status: "planned",
      },
      {
        title: "Logs in context",
        description:
          "See every log line exactly where it happened in the trace, automatically connected to the request or job that produced it.",
        status: "available",
      },
      {
        title: "Real user monitoring",
        description:
          "Collect page timings and navigation data from the browser, joined to the server trace by trace id.",
        status: "planned",
      },
      {
        title: "Know when a fix fails",
        description:
          "Track which release introduced a defect and automatically reopen resolved issues when the same failure comes back.",
        status: "planned",
      },
      {
        title: "Turn findings into issues",
        description:
          "Turn any error, trace, request or job into an actionable issue with severity, ownership, due dates, comments and a complete activity history.",
        status: "planned",
      },
    ],
  },
  {
    id: "runtime",
    label: "Jobs & runtime",
    heading: "Keep background work healthy",
    summary:
      "The work nobody is watching is the work that fails quietly. Yatta reports on it alongside your request traffic.",
    features: [
      {
        title: "Keep background jobs healthy",
        description:
          "Track queue wait time, retries and failures alongside your requests, with alerts when a backlog starts growing before it becomes an incident.",
        status: "available",
      },
      {
        title: "See what your runtime is doing",
        description:
          "Monitor CPU, memory and event-loop delay per process, with automatic detection when one instance starts carrying the load.",
        status: "available",
      },
      {
        title: "Understand your product flows",
        description:
          "See how requests move through your application and where failures happen, so you can spot the exact path that leads to a problem.",
        status: "available",
      },
      {
        title: "One dashboard, no setup",
        description:
          "A trace waterfall, stack inspection and live refresh ship with the framework. No agent to install, no pipeline to build.",
        status: "available",
      },
      {
        title: "See health per customer",
        description:
          "Scope issues to the users they affect, so one noisy account does not read as one widespread outage.",
        status: "planned",
      },
      {
        title: "Measure every release",
        description:
          "Compare releases by error rate, p50/p95/p99 and slow queries, plus which error fingerprints each one introduced or fixed.",
        status: "available",
      },
    ],
  },
  {
    id: "reliability",
    label: "Reliability",
    heading: "Reliability, under control",
    summary:
      "Turn raw telemetry into a signal someone can act on, rather than a dashboard nobody reads.",
    features: [
      {
        title: "Know before customers do",
        description:
          "Alert on error-budget burn rate instead of isolated spikes, so fast-moving incidents and slow degradation surface before they page anyone.",
        status: "planned",
      },
      {
        title: "Set reliability goals",
        description:
          "Define SLOs per route and method with a rolling error budget and burn rate. Too little traffic reports no-data instead of a verdict.",
        status: "available",
      },
      {
        title: "Catch reliability drift early",
        description:
          "Adaptive baselines catch drift against each metric's own history, using median and MAD so one stall cannot hide the event.",
        status: "available",
      },
      {
        title: "Know when things go quiet",
        description:
          "Detect silent failures automatically — from an application that stops receiving traffic to a cron job that never runs.",
        status: "planned",
      },
      {
        title: "Alerts that catch silence",
        description:
          "Alert on errors, anomalies, SLO burn, log patterns, or things that stop happening — with notifications through email, Slack, webhooks, or issues.",
        status: "planned",
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    heading: "Answer what changed, and why",
    summary:
      "Correlation engines over the telemetry you already record — each one reporting what it cannot see, and refusing to guess when the data runs out.",
    features: [
      {
        title: "Incident correlation",
        description:
          "Correlates the failing trace, its slow queries, release proximity and rule-outs into ranked suspects with an ordered timeline.",
        status: "available",
      },
      {
        title: "Evidence, not verdicts",
        description:
          "Every claim carries the evidence behind it and the reasons it could be wrong. Gaps are reported as Unknown rather than smoothed over.",
        status: "available",
      },
      {
        title: "It knows when it does not know",
        description:
          "Too few samples for a baseline, a metric with no observed variance, a first release with nothing to compare — each declines instead of guessing.",
        status: "available",
      },
      {
        title: "What changed?",
        description:
          "Compares the running release against the previous one: signed deltas, new error fingerprints, and which failures stopped.",
        status: "available",
      },
      {
        title: "Release health",
        description:
          "Per-release errors, p50/p95/p99, slow queries and affected routes, with a verdict derived from a real comparison rather than assumed.",
        status: "available",
      },
      {
        title: "N+1 query detection",
        description:
          "Finds identical queries repeated under one parent — the N+1 shape specifically — and estimates the avoidable cost.",
        status: "available",
      },
      {
        title: "Adaptive baselines",
        description:
          "Per-query slow thresholds derived from each query's own rolling p95, so a table that normally takes 400ms is no longer all flagged.",
        status: "available",
      },
      {
        title: "SLOs and error budgets",
        description:
          "Availability, remaining budget and burn rate per objective. A 5xx counts against availability; a 4xx does not.",
        status: "available",
      },
      {
        title: "Memory growth detection",
        description:
          "Least-squares trend with fit quality. A weak fit is reported as noise rather than called a leak.",
        status: "available",
      },
      {
        title: "Golden traces",
        description:
          "Mark a known-good run, then see exactly which step got slower, appeared or vanished in a later trace.",
        status: "available",
      },
      {
        title: "Dependency map",
        description:
          "A call graph inferred from spans, with the limitations stated on the result rather than left to be discovered.",
        status: "available",
      },
      {
        title: "Guarded actions",
        description:
          "Destructive operations are previewed, confirmed, and need an idempotency key so a double-click cannot purge twice.",
        status: "available",
      },
      {
        title: "Incident reports for AI",
        description:
          "A self-contained JSON payload with evidence, caveats and timeline — designed for a model or a colleague with no access to your process.",
        status: "available",
      },
      {
        title: "Trace to code",
        description:
          "Jump from a stack frame to the source line, with a resolver you opt into. Production bundles ship no sources, and it says so.",
        status: "available",
      },
      {
        title: "Command palette",
        description:
          "Cmd/Ctrl-K to jump to a view, open a trace by id, export an incident, or save a golden baseline.",
        status: "available",
      },
      {
        title: "Multi-node fleet aggregation",
        description:
          "Each cluster worker has its own observer. No leader aggregation yet — the dashboard shows one process.",
        status: "planned",
      },
      {
        title: "SQLite persistence for incidents",
        description:
          "Issues and transactions vanish on restart today. Persisting them needs retention and rotation.",
        status: "planned",
      },
      {
        title: "Alerting rules",
        description:
          "Error-rate spikes, p95 thresholds, blocked event loops, heap growth, with dedupe windows and quiet hours.",
        status: "planned",
      },
      {
        title: "Outbound HTTP instrumentation",
        description:
          "Tracing inbound but not outbound is the missing half of distributed tracing. Needed before the dependency map shows external services.",
        status: "planned",
      },
      {
        title: "Tail sampling",
        description:
          "Keep 100% of error and slow traces while sampling fast successes. The span tree is already there to make the decision.",
        status: "planned",
      },
    ],
  },
  {
    id: "metrics",
    label: "Metrics & cost",
    heading: "Metrics that fit your business",
    summary:
      "The same registry serves the built-in signals and whatever you choose to measure yourself.",
    features: [
      {
        title: "Measure what matters to you",
        description:
          "Track custom counters, gauges and histograms — from orders processed to queue depth — through the metrics registry, alongside built-in metrics.",
        status: "available",
      },
      {
        title: "Prometheus exposition, built in",
        description:
          "Your registry is already served in text exposition format at /_yatta/metrics. Point a scraper at it and nothing else changes.",
        status: "planned",
      },
      {
        title: "Keep observability costs under control",
        description:
          "tracesSampleRate records every n-th request, so trace volume is a share of your traffic rather than all of it. The choice is deterministic, not random, so the same load always produces the same traces and a sample is one you can go and read. Everything stays in-process.",
        status: "available",
      },
    ],
  },
];

const totals = groups.reduce(
  (acc, g) => {
    const shipped = g.features.filter((f) => f.status === "available").length;
    return {
      shipped: acc.shipped + shipped,
      total: acc.total + g.features.length,
      groups: [
        ...acc.groups,
        { id: g.id, label: g.label, heading: g.heading, shipped, total: g.features.length },
      ],
    };
  },
  { shipped: 0, total: 0, groups: [] as Array<{ id: string; label: string; heading: string; shipped: number; total: number }> },
);

const Badge = ({ status }: { status: Status }) =>
  status === "available" ? (
    <span className="shrink-0 border border-[#f3eed7]/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/45">
      Shipped
    </span>
  ) : (
    <span className="shrink-0 border border-dashed border-[#f3eed7]/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/35">
      Planned
    </span>
  );

const Observability = () => {
  const [scope, setScope] = useState<"all" | "shipped">("all");

  const visible = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          features:
            scope === "all"
              ? g.features
              : g.features.filter((f) => f.status === "available"),
        }))
        .filter((g) => g.features.length > 0),
    [scope],
  );

  const pct = Math.round((totals.shipped / totals.total) * 100);

  return (
    <section
      id="observe"
      className="relative w-full scroll-mt-20 bg-[#050505] px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/30">
              Yatta Observe
            </p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[#f3eed7] sm:text-5xl lg:text-6xl">
              See everything.
              <br />
              <span className="text-[#f3eed7]/30">Instrument nothing.</span>
            </h2>
          </div>

          <div className="flex flex-col justify-end gap-6 lg:col-span-6">
            <p className="text-base leading-7 text-[#f3eed7]/60 sm:text-lg sm:leading-8">
              Say goodbye to manual span wiring and blind spots. With Yatta
              Observe you get request tracing across every service, logs
              correlated to the request that wrote them, and errors grouped into
              defects with the source line that threw and the users they
              happened to.
            </p>
            <p className="text-sm leading-7 text-[#f3eed7]/40">
              Everything is instrumented by attaching your subsystems once. No
              sidecar, no agent, no vendor SDK, no calls to add.
            </p>
          </div>
        </header>

        {/* ── Availability ─────────────────────────────────────────── */}
        <div className="mt-14 border border-[#f3eed7]/10">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-medium tabular-nums tracking-tight text-[#f3eed7]">
                  {pct}%
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/30">
                  shipped · {totals.shipped} of {totals.total}
                </span>
              </div>

              {/* Segmented meter, one segment per group. */}
              <div className="mt-4 flex gap-1">
                {totals.groups.map((g) => (
                  <a
                    key={g.id}
                    href={`#obs-${g.id}`}
                    title={`${g.label}: ${g.shipped} of ${g.total} shipped`}
                    className="group relative block h-1.5 min-w-[3rem] flex-1 bg-[#f3eed7]/10 transition-colors hover:bg-[#f3eed7]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3eed7]/60"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-[#f3eed7]/70 transition-all duration-500"
                      style={{ width: `${(g.shipped / g.total) * 100}%` }}
                    />
                    <span className="sr-only">
                      {g.label}: {g.shipped} of {g.total} shipped
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div
              role="group"
              aria-label="Filter features by availability"
              className="flex shrink-0 border border-[#f3eed7]/15"
            >
              {(
                [
                  ["all", "Everything"],
                  ["shipped", "Shipped only"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scope === value}
                  onClick={() => setScope(value)}
                  className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3eed7]/60 ${
                    scope === value
                      ? "bg-[#f3eed7] text-[#050505]"
                      : "text-[#f3eed7]/45 hover:text-[#f3eed7]"
                  } ${value === "shipped" ? "border-l border-[#f3eed7]/15" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Group index — doubles as in-page navigation. Dividers come from a
              1px grid gap rather than per-item borders, which is the only way
              they stay correct at every breakpoint. */}
          <nav
            aria-label="Observability areas"
            className="grid grid-cols-2 gap-px border-t border-[#f3eed7]/10 bg-[#f3eed7]/10 sm:grid-cols-3 lg:grid-cols-5"
          >
            {totals.groups.map((g, i) => (
              <a
                key={g.id}
                href={`#obs-${g.id}`}
                className="group flex flex-col gap-1 bg-[#050505] px-5 py-4 transition-colors hover:bg-[#0a0a09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f3eed7]/60"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/25">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-[#f3eed7]/75 transition-colors group-hover:text-[#f3eed7]">
                  {g.label}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-[#f3eed7]/30">
                  {g.shipped}/{g.total}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {/* ── Groups ───────────────────────────────────────────────── */}
        <div className="mt-20 flex flex-col gap-16">
          {visible.map((group) => {
            const shipped = group.features.filter(
              (f) => f.status === "available",
            ).length;

            return (
              <section
                key={group.id}
                id={`obs-${group.id}`}
                aria-labelledby={`obs-${group.id}-h`}
                className="scroll-mt-24"
              >
                <div className="mb-6 flex flex-col gap-4 border-b border-[#f3eed7]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/30">
                      {group.label}
                    </p>
                    <h3
                      id={`obs-${group.id}-h`}
                      className="mt-2 text-2xl font-semibold tracking-tight text-[#f3eed7] sm:text-3xl"
                    >
                      {group.heading}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                    <p className="max-w-md text-sm leading-6 text-[#f3eed7]/45">
                      {group.summary}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f3eed7]/25">
                      {shipped} of {group.features.length} shipped
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-px overflow-hidden border border-[#f3eed7]/10 bg-[#f3eed7]/10 md:grid-cols-2 xl:grid-cols-3">
                  {group.features.map((feature, i) => (
                    <article
                      key={feature.title}
                      className="group relative flex flex-col gap-3 bg-[#050505] p-6 transition-colors duration-300 hover:bg-[#0a0a09] focus-within:bg-[#0a0a09]"
                    >
                      {/* Hover rule — the only motion on the card. */}
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[#f3eed7]/60 transition-transform duration-500 group-hover:scale-x-100"
                      />

                      <div className="flex items-start justify-between gap-4">
                        <h4
                          className={`text-base font-medium leading-snug tracking-tight ${
                            feature.status === "available"
                              ? "text-[#f3eed7]"
                              : "text-[#f3eed7]/55"
                          }`}
                        >
                          <span className="mr-2 font-mono text-[10px] tabular-nums text-[#f3eed7]/25">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {feature.title}
                        </h4>
                        <Badge status={feature.status} />
                      </div>

                      <p
                        className={`text-sm leading-6 ${
                          feature.status === "available"
                            ? "text-[#f3eed7]/50"
                            : "text-[#f3eed7]/30"
                        }`}
                      >
                        {feature.description}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="mt-24 flex flex-col gap-6 border-t border-[#f3eed7]/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-3xl text-2xl leading-tight tracking-tight text-[#f3eed7]/70 sm:text-3xl lg:text-4xl">
            Observability that starts itself, so you can spend the time on the
            failures instead of on the wiring.
          </p>

          <a
            href="/docs/observe"
            className="group inline-flex shrink-0 items-center gap-2 border border-[#f3eed7]/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/70 transition-colors hover:border-[#f3eed7]/40 hover:text-[#f3eed7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3eed7]/60"
          >
            Read the docs
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              ↗
            </span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Observability;