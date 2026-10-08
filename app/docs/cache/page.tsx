import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Cache — YATTA Docs",
  description:
    "Two-tier caching: an in-process LRU backed by SQLite, with singleflight, stale-while-revalidate, and tag-based invalidation.",
};

export default function CacheDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Cache" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Reads are the common case. Keep them off the database without giving up durability — L1 is memory, L2 is SQLite, and neither needs a Redis instance.">
        Cache
      </H1>

      <H2>Setup</H2>

      <CodeBlock
        title="yatta/func/cache.ts"
        code={`import { createCache, SQLiteL2CacheStore } from "yatta.js/cache";

export const cache = createCache({
  maxItems: 20_000,       // L1 capacity
  defaultTtl: "1h",
  l2Storage: new SQLiteL2CacheStore("Database/cache.db"),
});`}
      />

      <P>
        Drop <Code>l2Storage</Code> for a purely in-memory cache — useful in
        tests, or when a restart should reset everything.
      </P>

      <H2>Reading and writing</H2>

      <CodeBlock
        title="Basic"
        code={`await cache.set("user:42", { name: "Ada" }, { ttl: "5m" });

const user = await cache.get<{ name: string }>("user:42");
// → { name: "Ada" } | null

await cache.delete("user:42");`}
      />

      <P>
        A TTL of <Code>0</Code>, or none at all, means the entry does not expire —
        only LRU eviction removes it.
      </P>

      <Callout>
        A TTL has to be a duration. <code>ttl: Number(process.env.CACHE_TTL)</code>{" "}
        with the variable unset is <code>NaN</code>, and every TTL is consumed by{" "}
        <code>ttlMs &gt; 0 ? now + ttlMs : null</code> — so <code>NaN</code> did not
        fail the expiry, it set <code>expiresAt</code> to <code>null</code>, which means{" "}
        <em>never expires</em>. A cache configured that way has no expiry at all, which is
        unbounded staleness and unbounded memory. A non-finite or negative TTL is now a{" "}
        <code>QueueError</code>, and a bad <code>defaultTtl</code> is refused at
        construction rather than at the first write.
      </Callout>

      <H2>remember</H2>

      <P>
        <Code>remember</Code> is the useful one. It caches a factory&apos;s
        result, and while a value is being computed only one call runs — the
        rest wait for it. That removes the thundering herd when a popular key
        expires.
      </P>

      <CodeBlock
        title="Singleflight + SWR"
        code={`const user = await cache.remember(
  \`user:\${id}\`,
  "5m",                        // fresh for 5 minutes
  () => fetchUserFromDatabase(id),
  {
    swr: "30m",                // serve stale while refreshing
    tags: ["users", \`user:\${id}\`],
  },
);`}
      />

      <Note>
        With <Code>swr</Code> set, an expired entry is still returned while a
        background refresh runs. Requests never wait on the refresh.
      </Note>

      <H2>Tag invalidation</H2>

      <CodeBlock
        title="Invalidating"
        code={`await cache.set(\`user:42\`, data, { tags: ["users", "user:42"] });
await cache.set(\`user:43\`, data, { tags: ["users", "user:43"] });

// Drops every key tagged "users" across L1 and L2
await cache.invalidateTags(["users"]);`}
      />

      <P>
        Tag the keys you can name and invalidate the group — you do not need to
        remember each individual key.
      </P>

      <H2>Consistency</H2>

      <P>
        L2 writes default to awaiting the disk, which is slower but means a
        read after a write always sees it. Set <Code>{"consistency: \"async\""}</Code>{" "}
        to let writes land in the background.
      </P>

      <CodeBlock
        code={`await cache.set("k", v, { consistency: "async" });`}
      />

      <H2>Inspecting</H2>

      <CodeBlock
        title="Metrics"
        code={`const stats = cache.getMetrics();
// { size, hits, misses, evictions, hitRate, … }`}
      />

      <H2>Durations</H2>

      <P>
        Anywhere a duration is accepted you can pass a number of milliseconds
        or a readable string.
      </P>

      <CodeBlock
        code={`"500ms"  "10s"  "5m"  "2h"  "7d"  "1w"   // strings
500                                          // raw milliseconds`}
      />

      <H2>Global instance</H2>

      <P>
        If you do not want to thread a cache instance through your code, a
        configured default is available as a named export.
      </P>

      <CodeBlock
        code={`import { Cache } from "yatta.js/cache";

await Cache.set("k", v);
const v = await Cache.get("k");`}
      />

      <Note kind="warn">
        <code className="font-mono text-[13px]">get</code> returns{" "}
        <code className="font-mono text-[13px]">unknown</code> when no type
        parameter is given. Pass one —{" "}
        <code className="font-mono text-[13px]">{"cache.get<User>(\u0022u:1\u0022)"}</code>{" "}
        — so the result is usable.
      </Note>

      <DocFooter
        prev={{ href: "/docs/jobs", title: "Jobs & events" }}
        next={{ href: "/docs/storage", title: "Storage" }}
      />
    </article>
  );
}
