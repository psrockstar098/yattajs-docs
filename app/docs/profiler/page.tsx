import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Profiler — YATTA Docs",
  description:
    "An in-process sampling profiler: capture what code was running while a request was slow, render flamegraphs, and watch event-loop lag.",
};

export default function ProfilerDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Profiler" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Spans tell you which request was slow. A profile tells you what code was running while it was slow — sample the stack, find the hot functions, and render a flamegraph.">
        Profiler
      </H1>

      <P>
        The profiler is off by default and sampled when on. Importing the
        module starts no timer and no session — an app that never configures
        it pays nothing. It uses Bun&apos;s <Code>node:inspector</Code>{" "}
        profiler API, so captures run in-process while the server keeps
        serving.
      </P>

      <H2>Start and stop</H2>

      <CodeBlock
        title="yatta/func/profiler.ts"
        code={`import { SamplingProfiler, hotFunctions } from "yatta.js/profiler";

const profiler = new SamplingProfiler();

// Nothing is measured until start() is called.
await profiler.start();
await doTheSlowThing();
const profile = await profiler.stop();

for (const fn of hotFunctions(profile, 10)) {
  console.log(\`\${fn.function} — \${fn.selfPercent}% self time\`);
}`}
      />

      <P>
        <Code>stop()</Code> without <Code>start()</Code> returns{" "}
        <Code>null</Code>, not an empty profile dressed up as a result. A
        second <Code>start()</Code> while running is a no-op returning{" "}
        <Code>false</Code>. If the inspector session cannot start,{" "}
        <Code>start()</Code> throws instead of letting a caller read
        &ldquo;nothing was hot&rdquo; from a failed capture.
      </P>

      <H3>Options</H3>

      <Props
        items={[
          { name: "samplingIntervalUs", type: "number · 1000", desc: "Sample interval in microseconds — the same default as Bun's --cpu-prof-interval flag. Smaller means finer detail and more overhead." },
        ]}
      />

      <H2>Profiling one function</H2>

      <CodeBlock
        title="Profile a window"
        code={`import { SamplingProfiler, toFlamegraphSvg } from "yatta.js/profiler";

const profiler = new SamplingProfiler({ samplingIntervalUs: 1000 });
const { result, profile } = await profiler.profile(() => handleBatch());

// A self-contained SVG string. Serve it behind the observability gate,
// never on a public route: frame names still name internal functions.
const svg = toFlamegraphSvg(profile, { title: "Batch handler" });`}
      />

      <P>
        <Code>profile()</Code> starts, runs your function, stops, and returns
        both the function&apos;s result and the profile. If the function
        throws, the session is stopped before the error reaches you, so a
        failed capture never leaves a session running.
      </P>

      <H3>Flamegraph options</H3>

      <Props
        items={[
          { name: "title", type: "string", desc: "Heading drawn on the SVG. Kept to 200 characters." },
          { name: "width", type: "number · 1200", desc: "SVG width in pixels." },
          { name: "rowHeight", type: "number · 16", desc: "Height of one stack-depth row." },
          { name: "fontSize", type: "number · 12", desc: "Label font size." },
        ]}
      />

      <H2>Folded stacks and hot functions</H2>

      <CodeBlock
        title="Reading a profile"
        code={`import { collapsedStacks, hotFunctions } from "yatta.js/profiler";

// Folded-stack lines: "a;b;c count", the format flamegraph tools read.
const folded = collapsedStacks(profile);

// Functions ranked by self time: samples where the frame was on top.
const hot = hotFunctions(profile, 10);
// → [{ function, file, line, selfSamples, selfPercent, selfMsEstimate }]`}
      />

      <P>
        Shares are over samples, so they add up to the profile&apos;s sample
        count. Line numbers are positions in transpiled code, the same caveat
        as Bun&apos;s own <Code>--cpu-prof</Code> output — they may not match
        the TypeScript source line.
      </P>

      <Note>
        Sampling is statistical, not exact. A function absent from every
        sample did not run long enough to matter; a function on many samples
        is hot. For exact call counts, use spans, not a profiler.
      </Note>

      <H2>Event-loop lag</H2>

      <P>
        The lag monitor reads the same <Code>node:perf_hooks</Code> histogram
        the observability module uses, as a standalone caller-owned version.
        Each window is read and then reset, so a window&apos;s mean describes
        that window only — a cumulative mean would dilute a spike from
        minutes ago into invisibility.
      </P>

      <CodeBlock
        title="Lag monitor"
        code={`import { EventLoopLagMonitor } from "yatta.js/profiler";

const lag = new EventLoopLagMonitor({ windowMs: 1000 });
lag.start();

// After at least one window:
lag.current(); // { at, meanMs, p99Ms, maxMs } | null
lag.allSamples(); // retained windows, oldest first`}
      />

      <H3>Options</H3>

      <Props
        items={[
          { name: "windowMs", type: "number · 1000", desc: "How often a window is read, in milliseconds." },
          { name: "resolutionMs", type: "number · 10", desc: "Histogram resolution in milliseconds." },
          { name: "thresholdMs", type: "number", desc: "Call onThreshold (and threshold listeners) when a window's mean lag reaches this. Without it, no listener ever fires." },
          { name: "onThreshold", type: "(sample) => void", desc: "Called with each over-threshold window." },
          { name: "maxSamples", type: "number · 300", desc: "Retained windows; oldest dropped first." },
        ]}
      />

      <H2>Threshold-triggered capture</H2>

      <P>
        Wire a lag monitor to a capture: when lag stays over a threshold for
        a few windows in a row, a profile is taken automatically, then a
        quiet period follows so a sustained overload does not fill the store
        with back-to-back profiles.
      </P>

      <CodeBlock
        title="Capture on sustained lag"
        code={`import {
  SamplingProfiler,
  EventLoopLagMonitor,
  ThresholdCapture,
  attachLagTrigger,
} from "yatta.js/profiler";

const profiler = new SamplingProfiler();
const lag = new EventLoopLagMonitor({ windowMs: 1000, thresholdMs: 100 });
const capture = new ThresholdCapture({
  profiler,
  thresholdMs: 100,
  consecutive: 2, // two over-threshold windows before capturing
  captureDurationMs: 5000,
  cooldownMs: 60000, // quiet period after each capture
  maxCaptures: 5, // oldest evicted first
  onCapture: (c) => console.log("captured", c.hot[0]?.function),
});

capture.start();
lag.start();
const detach = attachLagTrigger(lag, capture);

// Later:
capture.captures(); // [{ startedAt, triggerValueMs, context, profile, hot, flamegraphSvg }]`}
      />

      <H3>Options</H3>

      <Props
        items={[
          { name: "profiler", type: "ProfilerLike", desc: "The profiler the capture starts and stops. Required." },
          { name: "thresholdMs", type: "number", desc: "Lag (or any millisecond signal) at or above this triggers. Required." },
          { name: "consecutive", type: "number · 1", desc: "Consecutive over-threshold observations before capturing." },
          { name: "captureDurationMs", type: "number · 5000", desc: "How long each capture samples, in milliseconds." },
          { name: "cooldownMs", type: "number · 60000", desc: "Quiet period after a capture before another may start." },
          { name: "maxCaptures", type: "number · 5", desc: "Retained captures; oldest evicted first." },
          { name: "onCapture", type: "(capture) => void", desc: "Called with each finished capture." },
        ]}
      />

      <P>
        <Code>observe()</Code> can also be fed any millisecond signal
        directly —{" "}
        <Code>{"capture.observe(durationMs, { route: \"/slow\" })"}</Code>.
        Context labels are sanitized: only short string values are kept, and
        anything under a credential-looking key is dropped.
      </P>

      <Callout>
        The lag monitor needs <Code>thresholdMs</Code> for listeners to fire.{" "}
        <Code>attachLagTrigger</Code> subscribes through the monitor&apos;s
        threshold listeners, which only run on over-threshold windows — wire
        it to a monitor without a threshold and nothing ever triggers.
      </Callout>

      <H2>Whole-process profiles</H2>

      <P>
        For a profile of an entire run, Bun&apos;s own flags are the
        complement. They write on exit and need a restart to change; this
        module covers targeted windows while the server keeps running.
      </P>

      <CodeBlock
        code={`bun --cpu-prof --cpu-prof-dir=./profiles app.ts
# writes a .cpuprofile on exit

bun --cpu-prof --cpu-prof-md app.ts
# adds a readable Markdown report with hot functions and a call tree

bun --cpu-prof --cpu-prof-interval=500 app.ts
# sample every 500 microseconds instead of the default 1000`}
      />

      <P>
        There is no <Code>--cpu-prof-flamegraph</Code> flag in Bun 1.4.4, so
        the flamegraph in this module is built from profile data directly.
        Heap profiling is out of scope here: Bun 1.4.4 also ships{" "}
        <Code>--heap-prof</Code> for whole-process heap profiles on exit, but
        no in-process heap API is built in this module.
      </P>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>No HTTP endpoint is included.</strong> Serving a flamegraph
          is the app author&apos;s job, behind the same gate as the rest of
          the observability surface. A profiler must not be switchable on by
          an unauthenticated request, so there is no request-triggered enable
          path here at all: only in-process code can start a capture.
        </LI>
        <LI>
          <strong>Flamegraphs carry function names and file basenames
          only.</strong> Full file paths are stripped, and no arguments, SQL
          text, headers, or request bodies are ever recorded. The raw profile
          Bun returns still carries full file URLs — pass it through{" "}
          <Code>sanitizeProfile()</Code> before storing it outside the
          process or serving it.
        </LI>
        <LI>
          <strong>A capture never steals another profile.</strong> If a
          profile is already running when a threshold fires, the capture
          steps aside instead of stopping someone else&apos;s capture when its
          window ends.
        </LI>
        <LI>
          <strong>Sampling is low overhead, not zero.</strong> The inspector
          samples the stack at the configured interval, and each sample costs
          a stack walk. A threshold capture adds at most one bounded profile
          per cooldown period, and a capture already in flight suppresses
          further triggers.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/vector-search", title: "Vector search" }}
        next={{ href: "/docs/message-bus", title: "Message bus" }}
      />
    </article>
  );
}
