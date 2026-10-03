import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { H1, P, Breadcrumb, DocFooter, Callout } from "@/components/docs/prose";
import EntryBlock from "@/components/docs/api/entry";
import { modules, getModule, type Entry } from "@/lib/api";

/** Pre-render one page per module at build time. */
export function generateStaticParams() {
  return modules.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) return {};

  return {
    title: `${mod.label} — API Reference`,
    description: mod.blurb,
  };
}

export default async function ModuleReference({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  const index = modules.findIndex((m) => m.slug === slug);
  const prev = index > 0 ? modules[index - 1] : undefined;
  const next = index < modules.length - 1 ? modules[index + 1] : undefined;

  // Group the flat export list into the tiers a reader actually cares about:
  // the things you construct, the things you configure, the types you name,
  // and the errors you catch.
  const groups: Array<{ title: string; match: (k: string) => boolean }> = [
    {
      title: "Construct",
      match: (k) => k === "function" || k === "async function" || k === "class",
    },
    { title: "Types", match: (k) => k === "interface" || k === "type" || k === "enum" },
    { title: "Values", match: (k) => k === "const" },
  ];

  const used = new Set<string>();
  const sections: Array<{ title: string; entries: Entry[] }> = groups
    .map((g) => {
      const entries = mod.entries.filter((e) => !used.has(e.name) && g.match(e.kind));
      entries.forEach((e) => used.add(e.name));
      return { title: g.title, entries };
    })
    .filter((g) => g.entries.length > 0);

  const leftover = mod.entries.filter((e) => !used.has(e.name));
  if (leftover.length > 0) sections.push({ title: "Other", entries: leftover });

  const memberCount = mod.entries.reduce((n, e) => n + e.members.length, 0);

  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "API reference", href: "/docs/api-reference" },
          { label: mod.label },
        ]}
      />

      <H1 eyebrow="API reference" sub={mod.blurb}>
        {mod.label}
      </H1>

      <P>
        {mod.entries.length} exported symbols and {memberCount} members, read from{" "}
        <code className="font-mono text-[13px] text-[#f3eed7]/60">{mod.source}</code>.
      </P>

      {/* Jump list — with 53 symbols on the auth page, scrolling is not viable. */}
      <nav className="mt-8 rounded-lg border border-[#f3eed7]/10 p-4">
        <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#f3eed7]/35">
          On this page
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mod.entries
            .filter((e) => e.kind !== "type" && e.kind !== "interface")
            .map((e) => (
              <a
                key={e.name}
                href={`#${e.name}`}
                className="rounded border border-[#f3eed7]/12 px-2 py-1 font-mono text-[12px] text-[#f3eed7]/55 transition-colors hover:border-[#f3eed7]/25 hover:bg-[#f3eed7]/[0.05] hover:text-[#f3eed7]"
              >
                {e.name}
              </a>
            ))}
        </div>
      </nav>

      {sections.map((section) => (
        <div key={section.title} className="mt-14">
          <h2
            id={section.title.toLowerCase()}
            className="mb-6 border-t border-[#f3eed7]/10 pt-8 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#f3eed7]/35 first:border-0"
          >
            {section.title}
          </h2>

          {section.entries.map((e) => (
            <EntryBlock key={e.name} entry={e} mod={mod} />
          ))}
        </div>
      ))}

      <Callout kind="tip">
        Most of the types above are inferred. You rarely import{" "}
        <code>AuthConfig</code> or <code>JobPayload</code> — declaring your schema
        once is enough for the rest to follow. See{" "}
        <a href="/docs/types" className="underline underline-offset-4">
          Typed keys
        </a>
        .
      </Callout>

      <DocFooter
        prev={
          prev
            ? { href: `/docs/api-reference/${prev.slug}`, title: prev.label }
            : undefined
        }
        next={
          next
            ? { href: `/docs/api-reference/${next.slug}`, title: next.label }
            : undefined
        }
      />
    </article>
  );
}
