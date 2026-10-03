import type { Metadata } from "next";
import Link from "next/link";
import { H1, P, Breadcrumb, DocFooter, Callout } from "@/components/docs/prose";
import { modules, totals } from "@/lib/api";

export const metadata: Metadata = {
  title: "API Reference — YATTA Docs",
  description:
    "Every exported symbol and method across the Yatta module surface, generated directly from the framework source.",
};

export default function ApiReferenceIndex() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[{ label: "Docs", href: "/docs" }, { label: "API reference" }]}
      />

      <H1
        eyebrow="Reference"
        sub="The complete public surface of every Yatta module — factories, classes, methods, types, and the errors each one throws."
      >
        API reference
      </H1>

      <P>
        These pages are generated from the framework source with the TypeScript
        compiler, so every signature below is the real one. When a method
        changes, this reference changes with it.
      </P>

      <div className="my-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#f3eed7]/10 bg-[#f3eed7]/[0.07]">
        {[
          { n: totals.modules, l: "modules" },
          { n: totals.symbols, l: "symbols" },
          { n: totals.members, l: "members" },
        ].map((s) => (
          <div key={s.l} className="bg-[#050505] px-4 py-4 text-center">
            <div className="font-mono text-2xl font-semibold text-[#f3eed7]">
              {s.n.toLocaleString()}
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#f3eed7]/35">
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <Callout kind="note">
        Import from the module path, never from the file path. <code>yatta/db</code>{" "}
        maps to <code>src/types/db.ts</code> in the repository, but that path is
        internal — the module specifier is the stable contract.
      </Callout>

      <ul className="mt-8 space-y-2">
        {modules.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/docs/api-reference/${m.slug}`}
              className="group block rounded-lg border border-[#f3eed7]/10 px-4 py-3.5 transition-colors hover:border-[#f3eed7]/20 hover:bg-[#f3eed7]/[0.03]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <code className="font-mono text-[14px] font-medium text-[#f3eed7]">
                  {m.label}
                </code>
                <span className="shrink-0 font-mono text-[11px] text-[#f3eed7]/30">
                  {m.entries.length} symbols ·{" "}
                  {m.entries.reduce((n, e) => n + e.members.length, 0)} members
                </span>
              </div>
              <p className="mt-1 text-[13.5px] leading-[1.6] text-[#f3eed7]/45">
                {m.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <DocFooter next={{ href: "/docs/runtime", title: "Worker runtime" }} />
    </article>
  );
}
