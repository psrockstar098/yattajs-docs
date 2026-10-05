import type { Metadata } from "next";
import {
  H1,
  H2,
  H3,
  P,
  UL,
  LI,
  Callout,
  Note,
  Code,
  Breadcrumb,
  DocFooter,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Observability — YATTA Docs",
  description:
    "Built-in observability for Yatta: tracing, metrics, logs, issue grouping, incident correlation, release intelligence, adaptive baselines, SLOs, N+1 detection and golden traces — with no external agent.",
};

export default function ObserveDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "The runtime" },
          { label: "Observability" },
        ]}
      />

      <H1
        eyebrow="The runtime"
        sub="Tracing, metrics, logs, issue grouping, incident correlation, release intelligence, adaptive baselines, SLOs, N+1 detection and golden traces — in-process."
      >
        Observability
      </H1>

      <P>
        <code>yatta/observe</code> is built into the framework. One{" "}
        <code>Observer</code> records spans, metrics, logs and issues, and derives
        analysis from them. Spans propagate through{" "}
        <code>AsyncLocalStorage</code>, so a trace follows a request into a job
        worker and out over SSE without passing anything around. Nothing leaves
        the process.
      </P>

      <Callout kind="note">
        Everything on this page is a current API. Where a capability is not
        implemented, it is not documented here — check the{" "}
        <a href="/docs">docs index</a> for the live surface.
      </Callout>

      <H2 id="setup">Setup</H2>

      <CodeBlock
        title="yatta/func/observe.ts"
        code={`import { createObserver } from "yatta.js/observe";

export const observer = createObserver({
  service: "app",
  release: process.env.GIT_SHA,
  // Logical OR, not ?? — an empty NODE_ENV is common in Docker and CI, and a
  // nullish coalesce treats "" as set, so a production container would read as
  // development and serve the dashboard.
  environment: process.env.NODE_ENV || "development",

  bufferSize: 2000,

  // Everything below this level is dropped before it is masked, buffered,
  // breadcrumb'd or broadcast. &ldquo;silent&rdquo; turns logging off entirely.
  logLevel: process.env.NODE_ENV === "production" ? "warn" : "info",

  // Off by default so it cannot leak a live process view.
  dashboard: process.env.NODE_ENV !== "production",

  // In adaptive mode this is a multiplier of each query's own rolling p95.
  slowQueryThresholdMs: 100,
  slowQueryMode: "fixed",

  // Record every 10th request's spans instead of every request's.
  tracesSampleRate: 1,
});`}
      />

      <Callout kind="warn">
        Create the observer <strong>once</strong>. Two instances means two async
        contexts, and a span started in one is never a parent of a span started
        in the other. Unknown config keys throw at construction rather than
        being ignored, so a typo like <code>runtimeMetric</code> fails at boot
        instead of silently leaving the feature off.
      </Callout>

      <H2 id="honesty">It reports what it does not know</H2>

      <P>
        An analysis that gives a confident answer when it is guessing is worse
        than no analysis, because it gets trusted. Every conclusion here carries
        the evidence behind it and the reasons it might be wrong, and gaps are
        reported rather than smoothed over.
      </P>

      <CodeBlock
        code={`const a = observer.analyzeIncident(fingerprint)!;

a.suspects[0]?.label;      // "Latency concentrated in db.query"
a.suspects[0]?.confidence; // "likely" | "possible" | "unknown"
a.suspects[0]?.score;      // 0..1 — ranks suspects, not a probability
a.suspects[0]?.evidence;   // what supports it
a.suspects[0]?.caveats;    // why it could still be wrong
a.unknowns;                // never empty — see below`}
      />

      <P>
        <code>unknowns</code> always carries a standing disclosure that the
        correlation is heuristic and based only on in-memory telemetry. Even a
        well-formed incident with plenty of data gets that line, so a consumer
        cannot render a bare &ldquo;Likely cause&rdquo; with nothing beside it.
      </P>

      <P>
        Where the data cannot support a claim, the engine declines rather than
        guessing:
      </P>

      <CodeBlock
        title="Refusals are explicit, not silent"
        code={`// Fewer than 20 samples for a baseline
{ anomalous: false, confidence: "unknown",
  caveats: ["Only 4 sample(s) of dbLatencyMs…; a baseline needs 20."] }

// Metric with zero observed variance — no noise scale to score against
{ z: null, anomalous: false,
  caveats: ["…has near-zero variance in this window…"] }

// Zero baseline for a ratio
{ changePct: null }        // not Infinity

// SLO with too little traffic
{ status: "no-data", achieved: null }

// First release, with nothing to compare against
{ status: "unknown" }      // not "healthy"

// Memory growing, but the fit is weak
{ verdict: "stable", caveats: ["Trend fit is weak (R²=0.21)…"] }`}
      />

      <H2 id="issues">Issues</H2>

      <P>
        Errors are grouped into <strong>issues</strong>. Each issue holds many{" "}
        <strong>occurrences</strong> — the individual events — and every
        occurrence links back to its trace.
      </P>

      <CodeBlock
        code={`ErrorIssue
├── fingerprint    groups every occurrence of the same failure
├── status         "unresolved" | "resolved" | "ignored"
├── firstSeen / lastSeen
├── count          total occurrences
├── name, message  of the first occurrence
├── statusCode     when the error carried one
├── topFrame       the in-app frame, for jumping to source
├── routes[]       every route it was seen from
├── sparkline[]    5-minute buckets for trend
└── occurrences[]  most recent 25`}
      />

      <H3 id="triage">Triage</H3>

      <CodeBlock
        code={`observer.errors.applyAction(fingerprint, "resolve");
observer.errors.applyAction(fingerprint, "ignore");
observer.errors.applyAction(fingerprint, "unresolve");

observer.errors.stats();   // { unresolved, events, … }

// Analysing through the reporter rather than the raw map keeps grouping,
// counting and the event log consistent with each other.
observer.recordError(preBuiltOccurrence);`}
      />

      <Callout kind="note">
        <code>recordError()</code> groups into the issue queue. An earlier
        version only pushed onto the event log, so errors arriving as pre-built
        occurrences never reached the dashboard&rsquo;s Errors view — which is exactly
        what that view reads.
      </Callout>

      <H3 id="grouping">Grouping</H3>

      <P>
        The fingerprint comes from the error name, a normalized message and the
        most salient in-application stack frames. Normalization is what stops one
        bug becoming a thousand issues:
      </P>

      <CodeBlock
        code={`User 123 failed   ─┐
User 456 failed   ─┼─▶  one fingerprint → one issue
User 789 failed   ─┘

computeSmartFingerprint(error, parseStackTrace(error.stack))`}
      />

      <H2 id="tracing">Tracing</H2>

      <CodeBlock
        code={`const span = observer.tracer.startSpan("checkout.service", {
  kind: "internal",
  attributes: { "cart.items": 12 },
});

try {
  const receipt = await processPayment(cart);
  span.ok();
  return receipt;
} catch (err) {
  span.recordError(err);
  throw err;                       // observe, never swallow
} finally {
  observer.tracer.endSpan(span);
}

// Or let the tracer handle it:
await observer.traceDb("orders.findMany", () => db.orders.findMany({ … }));
await observer.traceJob("send-receipt", () => send(receipt));`}
      />

      <P>
        <code>instrument()</code> wraps a fetch handler so every request becomes
        a server span with a trace id in the response headers:
      </P>

      <CodeBlock
        code={`const instrumented = observer.instrument(
  async (req) => handle(req),
  (req) => new URL(req.url).pathname,
);

Bun.serve({ fetch: (req, server) => instrumented(req) });`}
      />

      <Callout kind="warn">
        A handler that throws still records its status. Only recording it on the
        success path left <code>http.status_code</code> unset, so every consumer
        defaulted it to <code>200</code> — a crashed endpoint was counted as a
        fast successful request, inflating Apdex and hiding the failure in the
        transaction log.
      </Callout>

      <H2 id="sampling">Sampling</H2>

      <P>
        <code>tracesSampleRate</code> takes a number from 0 to 1. At{" "}
        <code>0.1</code>, roughly one request in ten has its spans recorded. At{" "}
        <code>1</code> (the default) every span is kept.
      </P>

      <CodeBlock
        code={`export const observer = createObserver({
  service: "app",
  tracesSampleRate: 0.1,
});`}
      />

      <P>
        Two details make it worth trusting. The decision is taken{" "}
        <strong>once per request</strong>, not once per span — every span in a
        sampled request is kept, so a trace is never half-recorded. And it is{" "}
        <strong>deterministic</strong>: every n-th span is taken rather than each
        one being rolled for. A random sample is one you cannot choose, which
        makes it useless to go and read.
      </P>

      <Callout kind="warn">
        An upstream <code>traceparent</code> header wins over the local rate. If
        a caller asked for a trace, it gets one whatever this is set to, and an
        unsampled caller does not flood this service with spans.
      </Callout>

      <P>
        Sampling reduces what you can see, not what the dashboard claims. Counters
        and baselines still see every request, because they do not come from
        spans. Anything derived from traces is reported with the sample rate
        attached.
      </P>

      <H2 id="metrics">Metrics and adaptive baselines</H2>

      <P>
        The observer retains a bounded sample history. Everything trend-shaped —
        adaptive thresholds, memory growth, backlog direction — is derived from
        it rather than from a current value.
      </P>

      <CodeBlock
        title="Per-query thresholds"
        code={`createObserver({
  slowQueryThresholdMs: 3,        // multiplier, not milliseconds
  slowQueryMode: "adaptive",
  baselineWindowMs: 15 * 60_000,
});

// A table that normally takes 400ms is no longer all flagged;
// a table that normally takes 5ms still gets caught.
observer.detectNPlusOne();       // repeated identical queries
observer.detectAnomalies({ cpuPercent: 88, queueDepth: 900 });`}
      />

      <Callout kind="note">
        During warm-up, adaptive queries are recorded but left{" "}
        <strong>unclassified</strong>. Treating the multiplier as a millisecond
        budget flagged nearly everything in the first few dozen calls, which is
        worse than saying &ldquo;not enough data yet&rdquo;. Baselines use median and MAD
        rather than mean and standard deviation, because a single stall drags a
        mean upward and inflates a σ — hiding the event worth reporting.
      </Callout>

      <H3 id="memory">Memory trend</H3>

      <CodeBlock
        code={`const t = observer.memoryTrend("rssMb");
t.growthMbPerHour;   // least-squares slope
t.rSquared;          // fit quality
t.verdict;           // "growing" | "stable" | "shrinking" | "insufficient-data"

t.caveats;  // sustained growth is consistent with a leak, never proof of one`}
      />

      <H2 id="releases">Releases</H2>

      <P>
        Set <code>release</code> and the observer records its own build at
        startup, from its own config rather than from a caller — so the timeline
        cannot claim a version that isn&rsquo;t the one running.
      </P>

      <CodeBlock
        code={`observer.releaseHealth();
// [{ release, requests, errors, errorRatePct, p50Ms, p95Ms, p99Ms,
//    slowQueries, newErrors[], affectedRoutes[], status }]

observer.whatChanged();
// { release, previousRelease, deltas[], newErrors[], fixedErrors[], summary[] }

// status is "unknown" for the first release and for any release whose
// comparison window has fewer than 20 requests — "healthy" would be an
// assumption dressed as a measurement.`}
      />

      <Callout kind="warn">
        &ldquo;Fixed&rdquo; errors key off <code>lastSeen</code>, not{" "}
        <code>firstSeen</code>. Keying off <code>firstSeen</code> reported every
        long-standing error as fixed on each release simply because it predates
        the deploy — including ones still firing hundreds of times a minute.
      </Callout>

      <H2 id="incidents">Incident correlation</H2>

      <CodeBlock
        code={`const a = observer.analyzeIncident(fingerprint)!;

a.timeline;            // ordered request/span/error events with offsets
a.suspects;            // ranked, each with evidence and caveats
a.suggestedActions;    // each with a rationale and a risk level
a.unknowns;            // what the data could not answer
a.stats.traceReusePct; // does one trace explain most failures?

observer.analyzeAllIncidents();   // every non-ignored issue, newest first`}
      />

      <P>
        It correlates the failing trace, the transaction, slow queries on the
        same trace, release proximity, and rule-outs. A suspect that the evidence
        rules <em>out</em> is reported as a suspect:
      </P>

      <CodeBlock
        code={`{
  id: "not-current-release",
  label: "Not caused by the current release (1.8.4)",
  confidence: "likely",
  evidence: [{ kind: "deploy", summary: "Issue first seen … under 1.8.3" }],
  caveats: ["A shared dependency or database change can affect every release
             at once, so an older release does not rule out an external cause."],
}`}
      />

      <H2 id="analysis-apis">Everything it derives</H2>

      <CodeBlock
        code={`observer.analyzeIncident(fp)      // timeline, suspects, actions
observer.analyzeAllIncidents()
observer.releaseHealth()
observer.whatChanged(release?)
observer.serviceMap()                // graph inferred from spans
observer.detectNPlusOne()
observer.detectAnomalies(values)
observer.memoryTrend(metric?)
observer.evaluateSlos()
observer.evaluateSlo(slo)
observer.jobHealth()
observer.incidentReport(fp)           // self-contained JSON
observer.saveGoldenTrace(name, traceId)
observer.compareToGolden(name, traceId)
observer.previewAction(request)
observer.performAction(request, executor, opts)`}
      />

      <H2 id="n-plus-one">N+1 detection</H2>

      <P>
        Database spans are grouped by the parent they were issued from.
        Repetition <em>under one parent</em> is the N+1 shape specifically — the
        same statement once per request is just traffic.
      </P>

      <CodeBlock
        code={`observer.detectNPlusOne();
// [{ traceId, parentName, normalizedSql, calls: 101,
//    eachMs: 5, avoidableMs: 500, severity: "high",
//    caveats: ["Repetition alone does not prove a loop…"] }]

// avoidableMs excludes the first call, which is necessary.`}
      />

      <H2 id="service-map">Dependency map</H2>

      <CodeBlock
        code={`const map = observer.serviceMap();
// nodes: api, database, cache, jobs, mail, realtime…

map.limitations;
// [
//   "Nodes are inferred from span names and kinds, so this shows instrumented
//    call paths rather than a declared architecture.",
//   "No producer or consumer spans were recorded, so asynchronous edges…
//    are missing.",
//   "No outbound HTTP client spans were recorded…"
// ]`}
      />

      <P>
        Nodes are classified from span kinds and names. A route span is the
        incoming edge of the API regardless of which span kind the
        instrumentation assigned it — splitting a route on <code>/</code> to
        guess a service name turned <code>POST /api/checkout</code> into a
        service called <code>post</code>.
      </P>

      <H2 id="slos">SLOs and error budgets</H2>

      <CodeBlock
        code={`createObserver({
  slos: [
    { name: "Checkout availability", target: 99.9, windowMs: 30 * 86_400_000 },
    { name: "Orders POST", target: 99, windowMs: 86_400_000,
      query: { route: "/api/orders", method: "POST" } },
  ],
});

observer.evaluateSlos();
// [{ name, target, requests, achieved, errorBudgetRemaining, burnRate,
//    status: "healthy" | "at-risk" | "breached" | "no-data", caveats[] }]`}
      />

      <Callout kind="note">
        A 5xx counts against availability; a 4xx does not, because it is a served
        answer rather than an outage. Burn rate is measured against the interval
        the traffic actually covers, not the configured window — deriving it from
        the window start made a 30-second burst in a 30-day window look like full
        coverage and understated burn rate by orders of magnitude.
      </Callout>

      <H2 id="jobs">Job health</H2>

      <CodeBlock
        code={`observer.jobHealth();
// { queued, running, delayed, completed, failed, dead,
//   successRate, backlog, growthPerMinute, caveats[] }

// backlog is "unknown" until there are 20 depth samples, and a small drift
// against a large queue is "stable" — +1/s at 10k queued is noise.`}
      />

      <H2 id="safe-actions">Guarded actions</H2>

      <P>
        Destructive operations are previewed before they run, require
        confirmation, and require an idempotency key so a double-click cannot
        purge twice.
      </P>

      <CodeBlock
        code={`const preview = observer.previewAction({ kind: "purge-dead-jobs" });
preview.risk;                 // "safe" | "caution" | "destructive"
preview.requiresConfirmation;  // true
preview.target;                // "all matching entries"
preview.reason;                // "Permanently discards failed jobs. They
                               //  cannot be replayed afterwards."

const outcome = observer.performAction(
  { kind: "purge-dead-jobs", idempotencyKey: requestId },
  execute,
  { confirmed: true },
);

outcome.deduplicated;  // true if the same key was already performed`}
      />

      <Callout kind="warn">
        Blocked attempts are audited too &mdash; &ldquo;someone tried to purge the queue at
        3am&rdquo; is itself the record worth keeping. The idempotency ledger lives on
        the observer instance; building it per request emptied it every time and
        a retried destructive action ran twice.
      </Callout>

      <H2 id="golden-traces">Golden traces</H2>

      <CodeBlock
        code={`observer.saveGoldenTrace("Cart — healthy", traceId);
observer.compareToGolden("Cart — healthy", traceId);
// { verdict, differences[] }

// differences: { step, kind: "extra" | "missing" | "slower" | "faster",
//               deltaMs, ratio, note }

// A missing step's note says it may be an improvement or a removed step —
// reporting it as a regression would train people to ignore it.`}
      />

      <P>
        A baseline records per-step timings, not just step names. Without them
        the comparison can detect a new or missing step but never a slowdown,
        which is the main reason to keep a golden trace at all.
      </P>

      <H2 id="source">Trace to code</H2>

      <CodeBlock
        code={`import { FileSystemTraceToCode } from "yatta.js/observe";
import fs from "node:fs";

// Opt-in: production builds usually ship no sources, and reading files off a
// running server is not something to enable implicitly.
observer.sourceResolver = new FileSystemTraceToCode(
  (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null,
  process.cwd(),
);

observer.sourceFor({ filePath, line, column });
// { lines: [{ number, text, isTarget }], missing?, reason?, caveats[] }`}
      />

      <Callout kind="warn">
        The resolver refuses any path outside the project root. A stack frame can
        carry any path an attacker put in an error message, so an unguarded read
        would turn a crafted trace into an arbitrary file read.
      </Callout>

      <H2 id="reporting">Incident reports</H2>

      <P>
        <code>incidentReport()</code> returns a self-contained JSON payload
        designed for a language model or a colleague with no access to the
        process. Conclusions travel with their evidence and their weaknesses.
      </P>

      <CodeBlock
        code={`const report = observer.incidentReport(fingerprint);
// {
//   schemaVersion: 1,
//   service: { name, release, version, environment },
//   summary: { errorName, message, occurrences, affectedRoutes, … },
//   likelyCauses: [{ claim, confidence, supportingEvidence[],
//                    reasonsItCouldBeWrong[] }],
//   knownUnknowns: [],
//   timeline: [],
//   suggestedNextSteps: [{ action, why }],
//   collectionGaps: []
// }`}
      />

      <Callout kind="note">
        <code>confidence</code> is rendered as a string carrying the score —
        <code>&ldquo;possible (score 0.4)&rdquo;</code> rather than a bare{" "}
        <code>possible</code> — so the number cannot be dropped in transit.
      </Callout>

      <H2 id="api">HTTP endpoints</H2>

      <CodeBlock
        code={`GET  /_yatta                              dashboard
GET  /_yatta/api/stream                      SSE event stream
GET  /_yatta/api/telemetry                   full application state
GET  /_yatta/api/traces/:id                   waterfall
GET  /_yatta/api/errors                      issue queue
GET  /_yatta/api/logs

POST /_yatta/api/errors/:action              resolve | ignore | unresolve
POST /_yatta/api/jobs/replay-dead
POST /_yatta/api/jobs/purge-dead
POST /_yatta/api/cache/clear

GET  /_yatta/api/analysis/state              every analysis, one call
GET  /_yatta/api/analysis/incident/:fp
GET  /_yatta/api/analysis/report/:fp
GET  /_yatta/api/analysis/goldens
POST /_yatta/api/analysis/goldens/:name?trace=
GET  /_yatta/api/analysis/compare/:name?trace=
POST /_yatta/api/analysis/action/:kind`}
      />

      <Callout kind="warn">
        Every state-changing route above requires <code>confirmed: true</code> and an{" "}
        <code>idempotencyKey</code>, from the body or from the query string. That
        includes <code>jobs/replay-dead</code>, <code>jobs/purge-dead</code> and{" "}
        <code>cache/clear</code>, which used to run their work inline and log
        afterwards — so the guard those three bypassed was exactly the thing someone
        would have bypassed.
      </Callout>

      <P>
        <code>performAction</code> is <code>async</code>. It used to be synchronous
        and did not await the executor, which put a pending promise in the outcome — and
        a promise serialises to <code>{"{}"}</code>, so the HTTP route answered{" "}
        <code>{"{ ok: true }"}</code> with no record of what had been done. You now
        get the real result back.
      </P>

      <H2 id="limits">What it cannot see</H2>

      <P>
        Stated by the features themselves rather than left to be discovered.
      </P>

      <UL>
        <LI>
          <strong>History is in-memory only.</strong> A restart loses it.
          Retention is bounded (720 samples by default) precisely so the observer
          cannot become the leak it exists to diagnose.
        </LI>
        <LI>
          <strong>No outbound HTTP instrumentation.</strong>{" "}
          <code>serviceMap()</code> reports this as a limitation; external
          dependencies appear only if a call site was wrapped explicitly.
        </LI>
        <LI>
          <strong>Source navigation needs a resolver</strong>, and production
          bundles ship no sources.
        </LI>
        <LI>
          <strong>SLO windows are bounded by retention.</strong> A 30-day
          objective measured against an in-process buffer will undercount, and
          says so in <code>caveats</code>.
        </LI>
      </UL>

      <H2>Access control</H2>

      <P>
        The dashboard, metrics and traces are not public by default. In production
        without a token, the whole surface answers <Code>404</Code> — not{" "}
        <Code>401</Code>, because an unauthenticated caller should not learn the
        surface exists.
      </P>

      <CodeBlock
        title="yatta/func/observe.ts"
        code={`export const observer = createObserver({
  service: "app",

  // Required in production. The dashboard serves traces, metric names and error
  // messages; on a public port that is an information disclosure.
  dashboardApiKey: process.env.YATTA_OBSERVE_TOKEN,
});`}
      />

      <Note kind="warn">
        A token set is enforced everywhere, not only in production — setting the
        variable is a statement of intent, and honouring it only in one environment
        means a staging deploy exposes everything.
      </Note>

      <H2 id="audit-actor">Who the audit log names</H2>

      <P>
        The dashboard is behind a single shared token, so the server has no way to
        tell two people holding it apart. Every audit entry therefore records{" "}
        <code>unknown (shared token)</code> unless the request sends an{" "}
        <code>x-observe-actor</code> header, which is reduced to a short printable
        label.
      </P>

      <P>
        That header is a self-declared label, <strong>not an identity</strong> —
        anyone with the token can put anything in it. It is useful for telling a CI
        job from a human, and worthless as proof. The entries used to all say{" "}
        <code>dashboard_operator</code>, which reads like a person but distinguishes
        nobody: a log where every line has the same actor cannot answer{" "}
        &ldquo;who flushed the cache&rdquo;.
      </P>

      <P>
        Attributing an action to a person needs real authentication in front of the
        dashboard. Until then, treat the audit trail as <em>what happened</em>, not{" "}
        <em>who did it</em>.
      </P>

      <DocFooter />
    </article>
  );
}