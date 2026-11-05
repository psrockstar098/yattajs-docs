import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Rate limiting — YATTA Docs",
  description:
    "A general rate-limit middleware for the onion pipeline: per-IP and per-user buckets, per-route overrides, escalating penalties, and an OAuth token preset.",
};

export default function RateLimitDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Rate limiting" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="A general limiter for ordinary routes — separate from auth's own attempt limits, which keep their lockouts and stay exactly as they are.">
        Rate limiting
      </H1>

      <P>
        This middleware limits how many requests one client may make in a
        window. It is the general limiter, not the auth limiter: login,
        signup, magic link, and passkey attempts keep their own limits, and
        this middleware does not touch them. Use this one for ordinary routes
        and for endpoints that had no limiter, like{" "}
        <Code>/oauth/token</Code>.
      </P>

      <H2>Setup</H2>

      <CodeBlock
        title="100 requests per minute, per IP, per route"
        code={`import { createAPI } from "yatta.js/api";
import { createRateLimit } from "yatta.js/ratelimit";

const api = createAPI();

// 100 requests per minute, per IP, per route.
api.use(createRateLimit({ limit: 100, windowSec: 60 }));

api.get("/hello", () => new Response("hi"));`}
      />

      <P>
        The route is part of every key, so one route&apos;s budget never
        affects another&apos;s. Limits are fixed windows: a bucket allows{" "}
        <Code>limit</Code> requests, then refuses until its window ends.
        There is no sliding window, and no lockout a stranger can trigger
        against a victim&apos;s account.
      </P>

      <H2>Per-route overrides</H2>

      <P>
        An override replaces the default rule for that route only.
      </P>

      <CodeBlock
        title="A stricter budget for one route"
        code={`api.use(
  createRateLimit({
    limit: 100,
    windowSec: 60,
    routes: {
      "/sensitive": { limit: 5, windowSec: 60 },
    },
  }),
);`}
      />

      <P>
        Override keys are normalised the same way request paths are — a
        trailing slash or different casing still matches the route it names.
      </P>

      <H2>Per-user limits</H2>

      <P>
        Add <Code>&quot;user&quot;</Code> to <Code>dimensions</Code> and the
        middleware checks a second bucket for the authenticated user, across
        IPs. A request must pass every bucket that applies to it, and a
        refused request consumes none of the buckets that passed.
      </P>

      <CodeBlock
        title="Per-IP and per-user buckets"
        code={`api.use(authMiddleware); // puts the user on ctx.state.user first
api.use(createRateLimit({ limit: 100, windowSec: 60, dimensions: ["ip", "user"] }));`}
      />

      <P>
        The user comes from <Code>ctx.state.user</Code> — a string id, or an
        object with an <Code>id</Code> — or from <Code>ctx.state.userId</Code>.
        A request with no user simply has no per-user bucket; it is never
        put in a shared &ldquo;anonymous&rdquo; bucket. Pass a{" "}
        <Code>userId</Code> function to resolve the id some other way.
      </P>

      <H2>Options</H2>

      <Props
        items={[
          { name: "limit", desc: "Requests allowed per window, per bucket. Default 100. Must be a finite integer of at least 1." },
          { name: "windowSec", desc: "Window length, in seconds. Default 60. Must be at least 1." },
          { name: "routes", desc: "Per-route overrides, keyed by path, each a { limit, windowSec } rule." },
          { name: "dimensions", desc: "Buckets to check: \"ip\", \"user\". Default [\"ip\"]. An empty list still limits per route, so the middleware can never be configured into a no-op." },
          { name: "userId", desc: "Function resolving the user id from ctx. Default: ctx.state.user (string id or object with id), else ctx.state.userId." },
          { name: "store", desc: "Counter store (get, set with a TTL in seconds, delete). Default is in-memory and single-process — see Cluster-wide limiting." },
          { name: "maxKeys", desc: "Distinct keys before new keys share one fallback bucket per route and dimension. Default 100000. Only enforced by stores that report a size." },
          { name: "trustProxy", desc: "Read forwarded headers for the client IP. Default false — forwarded headers are ignored completely." },
          { name: "trustedProxyCount", desc: "Proxies trusted to append to x-forwarded-for. Default 1." },
          { name: "getClientIp", desc: "Peer address resolver, e.g. (req) => server.requestIP(req)?.address under Bun." },
          { name: "escalation", desc: "{ violationsPerLevel, maxLevel }. Defaults 3 and 2 — see The penalty policy." },
          { name: "onBlocked", desc: "Called with { route, ip, user, retryAfterSec } when a request is refused, for logging or metrics. It must never throw into the request path; errors are swallowed." },
        ]}
      />

      <H2>The penalty policy</H2>

      <P>
        No flat block, no lockout. A violation is one window in which a key
        went over its limit; further over-limit requests in that same window
        do not add more violations, so one burst cannot jump a key to the
        harshest treatment.
      </P>

      <UL>
        <LI>
          <strong>0–2 violations:</strong> the normal limit and window.
        </LI>
        <LI>
          <strong>3–5 violations:</strong> the limit is halved (never below
          1) and the window is doubled.
        </LI>
        <LI>
          <strong>6 or more violations:</strong> the limit is 1 per window
          and the window is four times the base window.
        </LI>
        <LI>
          A full window with no violation removes one violation, so good
          behaviour restores normal treatment. A degraded key is slowed,
          never silenced outright, and no account is ever locked out by this
          middleware.
        </LI>
      </UL>

      <P>
        Tune it with <Code>escalation</Code>:{" "}
        <Code>violationsPerLevel</Code> is how many violations move a key one
        penalty level stricter, and <Code>maxLevel</Code> caps it.
      </P>

      <H2>Responses and headers</H2>

      <P>
        Refused requests answer <Code>429</Code> with a{" "}
        <Code>Retry-After</Code> header and a generic body —{" "}
        <Code>{"{ \"error\": \"Too many requests\" }"}</Code> — that names no
        IP, user, route budget, or penalty level, so a refused client learns
        nothing about whose bucket it hit.
      </P>

      <P>
        Successful responses carry <Code>X-RateLimit-Limit</Code>,{" "}
        <Code>X-RateLimit-Remaining</Code>, and{" "}
        <Code>X-RateLimit-Reset</Code> headers. The same numbers are on{" "}
        <Code>ctx.state.rateLimit</Code> for handlers —{" "}
        <Code>{`{ limit, remaining, resetAt, route }`}</Code> — with the
        strictest bucket deciding what the client sees.
      </P>

      <H2>The OAuth token endpoint</H2>

      <P>
        The OAuth module flags <Code>/oauth/token</Code> as having no rate
        limiting. This preset covers it: 5 token requests per minute per IP.
      </P>

      <CodeBlock
        title="Preset for the token endpoint"
        code={`import { oauthTokenRateLimit } from "yatta.js/ratelimit";

const oauthApi = createAPI();
oauthApi.use(oauthTokenRateLimit());
oauthApi.post("/token", (ctx) => oauth.handleToken(ctx.req));`}
      />

      <P>
        It changes nothing about OAuth itself — it only refuses the 6th
        request. Pass options to tighten or loosen it for a deployment.
      </P>

      <H2>Wiring the real client IP</H2>

      <P>
        Bun does not put the peer address on <Code>Request</Code>. Under{" "}
        <Code>Bun.serve</Code> it comes from{" "}
        <Code>server.requestIP(req)</Code>, which is the second argument to
        the <Code>fetch</Code> handler and returns{" "}
        <Code>{`{ address, port }`}</Code>, or <Code>null</Code> for a closed
        request or a Unix socket. Wire it like this:
      </P>

      <CodeBlock
        title="Peer address from Bun.serve"
        code={`const server = Bun.serve({
  fetch(req, server) {
    return api.handle(req, {});
  },
});

// Wherever the limiter is created:
createRateLimit({
  getClientIp: (req) => server.requestIP(req)?.address,
});`}
      />

      <Callout kind="warn">
        Without <Code>getClientIp</Code>, and without a peer address recorded
        at the edge, the middleware uses an <Code>&quot;unknown&quot;</Code>{" "}
        bucket — every unidentified client shares it. In production, always
        supply <Code>getClientIp</Code>.
      </Callout>

      <H2>Cluster-wide limiting</H2>

      <P>
        Counters live behind a <Code>RateLimitStore</Code> —{" "}
        <Code>get</Code>, <Code>set</Code> with a TTL in seconds,{" "}
        <Code>delete</Code> — the same shape as the auth attempt store. The
        default is in-memory and single-process. For more than one process,
        supply a store backed by storage every process can see, following
        the same pattern as a custom auth or OAuth store; the middleware
        itself does not change.
      </P>

      <CodeBlock
        title="A shared store"
        code={`const store = {
  async get(key) { /* ... */ },
  async set(key, data, ttlSec) { /* ... */ },
  async delete(key) { /* ... */ },
};
api.use(createRateLimit({ store }));`}
      />

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>Forwarded headers are ignored by default.</strong> Only
          set <Code>trustProxy</Code> when a proxy you control sets those
          headers and strips any incoming copy. Otherwise a client forges a
          fresh <Code>x-forwarded-for</Code> per request and mints a fresh
          bucket each time. When trusted, the client IP is counted back from
          the right-hand end of <Code>x-forwarded-for</Code> past{" "}
          <Code>trustedProxyCount</Code> entries — the leftmost entry is the
          one the client wrote, so it is never used.
        </LI>
        <LI>
          <strong>Parent middleware runs for mounted routers.</strong> A
          parent&apos;s middleware wraps the whole dispatch, including
          mounted child routers — so a limiter on the parent does cover a
          mounted <Code>/oauth</Code> router. But the limiter always keys on
          the full request path as the client sees it, so per-route
          overrides must name the full path —{" "}
          <Code>/oauth/token</Code>, not <Code>/token</Code> — even when the
          limiter sits on the mounted router itself.
        </LI>
        <LI>
          <strong>Per-user limiting needs auth first.</strong> The user
          comes from <Code>ctx.state.user</Code>, so the auth middleware
          must run before this one.
        </LI>
        <LI>
          <strong>Shared IPs share a bucket.</strong> Clients behind one NAT
          address or one egress proxy count together on the per-IP bucket.
          The per-user bucket is the fix for authenticated routes; for
          anonymous routes this is inherent to per-IP limiting, and the
          minimum limit of 1 keeps a shared address from being silenced
          outright.
        </LI>
        <LI>
          <strong>IPv4-mapped IPv6 is folded.</strong> A client seen as{" "}
          <Code>::ffff:1.2.3.4</Code> (an IPv4 peer on a dual-stack socket,
          which is what <Code>server.requestIP</Code> returns) is bucketed
          as <Code>1.2.3.4</Code>, so one client cannot hold two buckets by
          address spelling. Genuine IPv6 addresses are left as they are.
        </LI>
        <LI>
          <strong>Check-then-increment is not atomic.</strong> Through a
          shared store, heavy concurrent load can admit a few requests past
          the limit. A store with an atomic increment avoids that; the
          in-memory default is exact for one process.
        </LI>
        <LI>
          <strong>This is not the auth limiter.</strong> Auth attempt
          limits, with their lockouts, are unchanged and untouched by this
          middleware. Do not use this middleware to replace them on login
          or signup routes.
        </LI>
      </UL>

      <Note>
        Validation is strict on purpose: a non-integer limit, a window under
        one second, an unknown dimension, or a <Code>maxKeys</Code> under 1
        throws at construction. A bad limit must fail loudly, not silently
        disable the limiter.
      </Note>

      <DocFooter
        prev={{ href: "/docs/api", title: "HTTP API" }}
        next={{ href: "/docs/cache-decorator", title: "Cache decorator & edge purge" }}
      />
    </article>
  );
}
