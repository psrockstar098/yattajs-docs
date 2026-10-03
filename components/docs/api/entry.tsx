// components/docs/api/entry.tsx
//
// Renders one extracted symbol — signature, documentation, parameters, return
// value, and the full member list of a class or interface.
//
// Everything shown here comes from lib/api-surface.json, which is generated
// from the framework source. Nothing is hand-written, so a signature on this
// page is the signature in the code.

import Link from "next/link";
import type { Entry, Member, Module } from "@/lib/api";
import { CodeBlock } from "../code-block";

/** Link a TypeScript type name to the reference page that documents it. */
function typeHref(name: string, mod: Module): string | undefined {
  const clean = name.replace(/<.*$/, "").replace(/[?[\]]/g, "").trim();
  if (!clean || !/^[A-Z]/.test(clean)) return undefined;

  const target = mod.entries.find((e) => e.name === clean);
  return target ? `/docs/api-reference/${mod.slug}#${clean}` : undefined;
}

function Signature({ text, mod }: { text: string; mod: Module }) {
  return (
    <code className="block overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed text-[#c3d68a]">
      {text.split(/(\b[A-Z][A-Za-z0-9]*\b)/).map((part, i) => {
        const href = typeHref(part, mod);
        if (!href) return <span key={i}>{part}</span>;
        return (
          <Link
            key={i}
            href={href}
            className="underline decoration-[#c3d68a]/30 underline-offset-2 hover:decoration-[#c3d68a]"
          >
            {part}
          </Link>
        );
      })}
    </code>
  );
}

const KIND_LABEL: Record<string, string> = {
  function: "function",
  "async function": "async function",
  class: "class",
  interface: "interface",
  type: "type",
  enum: "enum",
  const: "const",
};

/** Small mono tag in the margin, the way a typed signature is annotated. */
function Kind({ kind }: { kind: string }) {
  return (
    <span className="shrink-0 rounded border border-[#f3eed7]/12 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#f3eed7]/40">
      {KIND_LABEL[kind] ?? kind}
    </span>
  );
}

function MemberRow({ m }: { m: Member }) {
  return (
    <li className="border-t border-[#f3eed7]/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="font-mono text-[13px] font-medium text-[#f3eed7]">
          {m.name}
        </code>
        {m.kind !== "method" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#f3eed7]/30">
            {m.kind}
          </span>
        )}
      </div>

      {m.signature && (
        <div className="mt-1.5 overflow-x-auto">
          <code className="whitespace-pre font-mono text-[12.5px] text-[#f3eed7]/45">
            {m.signature}
          </code>
        </div>
      )}

      {m.summary && (
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#f3eed7]/55">
          {m.summary}
        </p>
      )}
      {m.note && (
        <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#f3eed7]/45">
          {m.note}
        </p>
      )}

      {m.params.length > 0 && (
        <dl className="mt-2 space-y-1">
          {m.params.map((p) => (
            <div key={p.name} className="flex gap-2 text-[13px]">
              <dt className="shrink-0 font-mono text-[#f3eed7]/60">{p.name}</dt>
              <dd className="text-[#f3eed7]/45">{p.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {m.returns && (
        <p className="mt-2 text-[13px] text-[#f3eed7]/45">
          <span className="font-mono text-[#f3eed7]/60">Returns</span>{" "}
          {m.returns}
        </p>
      )}

      {m.example && (
        <div className="mt-3">
          <CodeBlock code={m.example} />
        </div>
      )}
    </li>
  );
}

export default function EntryBlock({ entry, mod }: { entry: Entry; mod: Module }) {
  const { members, ...head } = entry;

  return (
    <section className="border-t border-[#f3eed7]/[0.08] py-10 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        {/* The anchor lives on the heading, not the section: the page outline
            scans `main h2[id]`, so an id on the wrapper would leave every
            symbol invisible to it. */}
        <h2
          id={entry.name}
          className="scroll-mt-24 font-mono text-[1.25rem] font-semibold tracking-tight text-[#f3eed7]"
        >
          {entry.name}
        </h2>
        <Kind kind={entry.kind} />
      </div>

      {head.summary && (
        <p className="mt-3 text-[15px] leading-[1.7] text-[#f3eed7]/70">
          {head.summary}
        </p>
      )}
      {head.note && (
        <p className="mt-2 text-[14px] leading-[1.7] text-[#f3eed7]/50">
          {head.note}
        </p>
      )}

      {/* The signature sits on its own dark plate so long generics scroll
          horizontally instead of wrapping the layout. */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-[#f3eed7]/10 bg-[#0b0b0b] px-4 py-3">
        <Signature text={entry.signature} mod={mod} />
        {entry.overloads && entry.overloads.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-[#f3eed7]/[0.07] pt-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#f3eed7]/30">
              Also accepts
            </p>
            {entry.overloads.map((o, i) => (
              <div key={i} className="overflow-x-auto">
                <Signature text={o} mod={mod} />
              </div>
            ))}
          </div>
        )}
      </div>

      {head.params.length > 0 && (
        <dl className="mt-4 space-y-2">
          {head.params.map((p) => (
            <div key={p.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-mono text-[13px] text-[#f3eed7]/70 sm:w-32">
                {p.name}
              </dt>
              <dd className="text-[13.5px] leading-[1.6] text-[#f3eed7]/50">
                {p.text}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {head.returns && (
        <p className="mt-3 text-[13.5px] leading-[1.6] text-[#f3eed7]/50">
          <span className="font-mono text-[#f3eed7]/70">Returns</span>{" "}
          {head.returns}
        </p>
      )}

      {head.example && (
        <div className="mt-5">
          <CodeBlock code={head.example} />
        </div>
      )}

      {members.length > 0 && (
        <div className="mt-7">
          <h3 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#f3eed7]/35">
            {members.length} member{members.length === 1 ? "" : "s"}
          </h3>
          <ul className="space-y-3">
            {members.map((m) => (
              <MemberRow key={`${m.kind}-${m.name}`} m={m} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
