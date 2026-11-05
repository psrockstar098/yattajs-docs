import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Props, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Cache decorator & edge purge — YATTA Docs",
  description:
    "Cache a function in one line with wrapCached, and purge Cloudflare or Vercel edge caches when a tag is invalidated locally.",
};

export default function CacheDecoratorDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Cache decorator & edge purge" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Two additions on top of the two-tier cache, and nothing else: a wrapper so a function can be cached in one line, and edge purge bindings so invalidating a tag locally also purges it at Cloudflare or Vercel.">
        Cache decorator &amp; edge purge
      </H1>

      <P>
        The two-tier cache (in-memory L1 + SQLite L2, TTL,
        stale-while-revalidate, tag invalidation) is unchanged. This adds two
        things on top of it, and nothing else.
      </P>

      <H2>Decorator: cache a function</H2>

      <CodeBlock
        title="One line to cache a function"
        code={`import { MemoryCacheEngine } from "yatta.js/cache";
import { wrapCached } from "yatta.js/cache-decorator";

const cache = new MemoryCacheEngine({ maxItems: 10_000 });

const getProfile = wrapCached(
  async (id: string) => fetchProfileFromDatabase(id),
  { ttl: "5m", tags: (id: string) => [\`user:\${id}\`] },
  cache,
);

await getProfile("42"); // runs the function
await getProfile("42"); // served from cache, function not run
await cache.invalidateTags("user:42"); // next call runs the function again`}
      />

      <P>
        Everything delegates to <Code>cache.remember</Code>, so TTL, SWR,
        singleflight, and both tiers behave exactly as they do with the
        engine directly. There is no second cache to drift out of sync.
        Failures are never cached: the engine only stores a value the
        function actually returned, so a thrown error leaves nothing behind
        for the next call to read.
      </P>

      <H2>Options</H2>

      <Props
        items={[
          { name: "ttl", desc: "Time-to-live for each entry, e.g. \"5m\" or 300_000. Required — there is no \"cache forever\" default to fall into. A decorator without one is a construction error." },
          { name: "swr", desc: "Stale-while-revalidate grace period after TTL expiry. During it the stale value is returned while a background refresh runs. Leave unset for data that must never be served stale." },
          { name: "tags", desc: "Tags attached to every entry this function produces. A fixed list, or a function of the call arguments — so one call can be tagged user:42 and invalidated on its own." },
          { name: "key", desc: "Cache key override. A string is a prefix: the hashed arguments are still appended, so different arguments never share an entry. A function returns the full key and owns uniqueness." },
          { name: "scope", desc: "Extra namespace prepended to the key, e.g. a tenant id. A string, or a function of the call arguments." },
          { name: "prefix", desc: "Prefix for the default key. Defaults to the wrapped function's name." },
          { name: "cache", desc: "The engine to delegate to. Also accepted as the third argument to wrapCached. There is no implicit global engine, so importing this module never opens a database." },
        ]}
      />

      <CodeBlock
        title="Key shapes"
        code={`// TTL is required. There is no "cache forever" default to fall into.
wrapCached(fn, { ttl: "5m" }, cache);

// A string key is a prefix: different arguments still get different entries.
wrapCached(fn, { ttl: "5m", key: "double" }, cache);

// A key function returns the full key and owns uniqueness.
wrapCached(fn, { ttl: "5m", key: (id: string) => \`user:\${id}\` }, cache);

// Stale-while-revalidate: stale value served during the grace period
// while a background refresh runs. Leave it unset for data that must
// never be served stale.
wrapCached(fn, { ttl: "5m", swr: "15m" }, cache);`}
      />

      <P>
        The default key is the function name (or <Code>prefix</Code>) plus a
        hash of the arguments, so argument values never become stored key
        text in the L2 database. A value{" "}
        <Code>JSON.stringify</Code> cannot represent — a circular object, a
        function, a symbol — is refused instead of silently mapping onto
        some other call&apos;s key.
      </P>

      <H2>Method form</H2>

      <P>
        <Code>cacheMethod</Code> is the same wrapper for class methods, in
        the classic decorator shape —{" "}
        <Code>(target, propertyKey, descriptor)</Code> — so it needs the
        classic decorator setting where it is used. Applied without
        decorator syntax it is just a function call, which works in any
        setup. There is also a <Code>cache</Code> alias matching the{" "}
        <Code>@cache</Code> name.
      </P>

      <CodeBlock
        title="Caching a class method"
        code={`import { cacheMethod } from "yatta.js/cache-decorator";

class Service {
  // @cacheMethod({ ttl: "5m" }, cache)
  async load(id: string) { /* ... */ }
}`}
      />

      <P>
        The default key is <Code>ClassName.method</Code> plus a hash of the
        arguments, so argument values never become stored key text. It does
        not include the instance: if the result depends on instance state,
        pass a <Code>key</Code> function — it receives the instance as{" "}
        <Code>this</Code> and the arguments after it, so it can include an
        instance id — or wrap the method with <Code>wrapCached</Code> per
        instance instead.
      </P>

      <H2>Edge purge: invalidate locally, purge at the edge</H2>

      <CodeBlock
        title="An edge-aware engine"
        code={`import { EdgeAwareCacheEngine, createEdgePurgeFromEnv } from "yatta.js/cache-edge";

const cache = new EdgeAwareCacheEngine({
  maxItems: 10_000,
  edge: createEdgePurgeFromEnv(), // null when nothing is configured
});

await cache.invalidateTags("users");
// Local entries tagged "users" are gone, and the same tags are purged
// at the configured edge provider. No provider, no network call.`}
      />

      <P>
        One-time setup, then it is automatic. &ldquo;Automatic&rdquo; means
        automatic-after-one-time-setup, not zero-config: you set the provider
        and its credentials once (below), and every later tag invalidation
        purges the edge on its own. With no provider configured, behavior is
        exactly today&apos;s local-only invalidation. You can also pass{" "}
        <Code>edge: null</Code> explicitly for local-only, or hand a
        provider to <Code>withEdgePurge(options)</Code>, which builds the
        same engine.
      </P>

      <H2>Provider setup</H2>

      <CodeBlock
        title="Environment variables"
        code={`# Cloudflare: scoped token with the Cache Purge permission + zone id
YATTA_EDGE_PROVIDER=cloudflare
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...

# Vercel: API token + project id or name, optional team id
YATTA_EDGE_PROVIDER=vercel
VERCEL_API_TOKEN=...
VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...  # optional`}
      />

      <P>
        Cloudflare purges by tag and by URL (
        <Code>POST /zones/{"{zone}"}/purge_cache</Code>). Vercel purges by
        tag only (<Code>POST /v1/edge-cache/invalidate-by-tags</Code>): a
        URL-only purge is a no-op there, because that endpoint cannot purge
        by URL. A provider name with missing credentials is treated as
        unconfigured, with a warning naming the missing variable.
      </P>

      <P>
        Existing code with a plain engine can add an edge purge without
        swapping engines:
      </P>

      <CodeBlock
        title="One-off edge purge from a plain engine"
        code={`import { invalidateTagsWithEdge } from "yatta.js/cache-edge";

await invalidateTagsWithEdge(cache, "users", provider);`}
      />

      <P>
        To purge edge URLs as well, call{" "}
        <Code>cache.purgeEdge({"{"} tags, urls {"}"})</Code> on an
        edge-aware engine — local tag invalidation has no URLs to purge, so{" "}
        <Code>invalidateTags</Code> purges by tag only. It returns{" "}
        <Code>true</Code> when a purge was attempted and accepted,{" "}
        <Code>false</Code> when the provider failed or is absent.
      </P>

      <H2>Zero cost when not used</H2>

      <UL>
        <LI>
          The existing cache engine is untouched, so undecorated use runs
          exactly the code it ran before — no wrapper, no extra check.
        </LI>
        <LI>
          Importing the decorator or edge modules creates nothing: no
          engine, no database, no network call. A function costs nothing
          until it is actually wrapped, and only its calls go through the
          engine.
        </LI>
        <LI>
          Edge modules are never imported by startup code. Nothing in the
          main entrypoint or the cache subsystem imports them; an app loads
          them only when it imports{" "}
          <Code>yatta.js/cache-decorator</Code> or{" "}
          <Code>yatta.js/cache-edge</Code>.
        </LI>
        <LI>
          With no provider configured, <Code>invalidateTags</Code> on an
          edge-aware engine does not enter the purge path at all — not even
          a no-op network attempt. The only cost is one null check.
        </LI>
      </UL>

      <H2>Gotchas</H2>

      <UL>
        <LI>
          <strong>Fail-open, by design.</strong> If the edge provider fails
          or is slow (requests time out after 5 seconds), local invalidation
          still stands and the caller gets the local result, plus a warning.
          The edge copy may lag until the next invalidation or its own TTL.
          A failed edge purge never makes local data look stale when it is
          not.
        </LI>
        <LI>
          <strong>No purge-everything.</strong> An empty tag/URL list is a
          no-op, never a whole-cache purge. Purging everything stays a
          dashboard action.
        </LI>
        <LI>
          <strong>A tag purge only matches tagged responses.</strong>{" "}
          Cloudflare purges by tag only content whose responses carry a
          matching <Code>Cache-Tag</Code> header, and Vercel likewise only
          content tagged with <Code>Vercel-Cache-Tag</Code>. If the origin
          never emits those headers, the purge call succeeds and removes
          nothing. Tagging the response is part of the setup, not an
          afterthought.
        </LI>
        <LI>
          <strong>Credentials live in the environment only.</strong> They
          are never in code, never in tests (tests use fake fetches), never
          in a URL, and never in a log line or error message.
        </LI>
        <LI>
          <strong>Never expose invalidation as an unauthenticated
          endpoint.</strong> This module adds no HTTP route. Anyone who can
          call <Code>invalidateTags</Code> on an edge-aware engine can purge
          the edge cache, so keep that call server-side, behind the same
          auth as the mutation it follows.
        </LI>
        <LI>
          <strong>The default key does not know the caller.</strong> If the
          result depends on the user, tenant, or instance, and the arguments
          do not carry that identity, two callers share one entry. Scope it
          explicitly —{" "}
          <Code>scope: (tenant) =&gt; &quot;tenant:&quot; + tenant</Code> — or
          pass a <Code>key</Code> function that includes the identity.
        </LI>
        <LI>
          <strong>Keys are hashed, values are not.</strong> Hashing keeps
          argument values out of stored keys, but the cached value itself is
          still stored in L1 and (when configured) L2. Do not cache secrets,
          and do not set an SWR grace period on data that must never be
          served after its TTL.
        </LI>
        <LI>
          <strong>The edge purge is awaited.</strong>{" "}
          <Code>invalidateTags</Code> on an edge-aware engine waits for the
          edge call (bounded by the timeout) before returning, so the purge
          is not silently dropped when the process exits right after
          invalidation.
        </LI>
      </UL>

      <Note>
        Cloudflare sends tags and URLs as separate requests, because its API
        accepts one purge mode per request body — sending both in one body
        would be rejected and the whole purge would fail.
      </Note>

      <DocFooter
        prev={{ href: "/docs/rate-limit", title: "Rate limiting" }}
        next={{ href: "/docs/migrate-generate", title: "Auto-migrations" }}
      />
    </article>
  );
}
