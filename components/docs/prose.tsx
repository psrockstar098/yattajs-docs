// components/docs/prose.tsx
//
// Typography primitives shared by every docs page, so headings, paragraphs,
// lists, callouts and tables stay consistent without repeating class strings.

import Link from "next/link";
import type { ReactNode } from "react";

/* ── Page furniture ─────────────────────────────────────────────────────── */

/** Small category line above the page title. */
export function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/35"
    >
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[#f3eed7]/60">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#f3eed7]/55">{item.label}</span>
          )}
          {i < items.length - 1 ? (
            <span aria-hidden className="text-[#f3eed7]/20">
              /
            </span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}

export function H1({
  children,
  sub,
  eyebrow,
}: {
  children: ReactNode;
  sub?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-10">
      {eyebrow ? (
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/40">
          {eyebrow}
        </div>
      ) : null}

      <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f3eed7] sm:text-[2.75rem]">
        {children}
      </h1>

      {sub ? (
        <p className="mt-4 max-w-2xl text-[17px] leading-[1.7] text-[#f3eed7]/55">
          {sub}
        </p>
      ) : null}
    </header>
  );
}

/**
 * Slug used for a heading anchor. Only applied when the heading is given
 * plain text, so the page outline works without every page declaring ids.
 */
function slugify(node: ReactNode): string | undefined {
  if (typeof node !== "string") return undefined;
  const slug = node
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug || undefined;
}

/** `id` anchors the heading so the page outline can link to it. */
export function H2({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h2
      id={id ?? slugify(children)}
      className="mt-14 mb-4 scroll-mt-24 border-t border-[#f3eed7]/10 pt-8 text-[1.5rem] font-semibold tracking-[-0.02em] text-[#f3eed7] first:border-0 first:pt-0"
    >
      {children}
    </h2>
  );
}

export function H3({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h3
      id={id ?? slugify(children)}
      className="mt-9 mb-3 scroll-mt-24 text-[1.0625rem] font-semibold tracking-[-0.01em] text-[#f3eed7]/85"
    >
      {children}
    </h3>
  );
}

/* ── Body copy ──────────────────────────────────────────────────────────── */

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="my-5 text-[15px] leading-[1.75] text-[#f3eed7]/65">
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="my-5 space-y-2 pl-5 text-[15px] leading-[1.75] text-[#f3eed7]/65 marker:text-[#f3eed7]/30">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

/** Ordered list, used where sequence matters. */
export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="my-5 space-y-2 pl-6 text-[15px] leading-[1.75] text-[#f3eed7]/65 marker:text-[#f3eed7]/35">
      {children}
    </ol>
  );
}

/** Inline `code`. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-[#f3eed7]/10 bg-[#f3eed7]/[0.05] px-[0.3em] py-[0.1em] font-mono text-[0.875em] text-[#f3eed7]/85">
      {children}
    </code>
  );
}

/* ── Callouts ───────────────────────────────────────────────────────────── */

const CALLOUTS = {
  note: { label: "Note", accent: "text-[#f3eed7]/55" },
  tip: { label: "Tip", accent: "text-[#8ab4a8]" },
  warn: { label: "Warning", accent: "text-[#d9a441]" },
  important: { label: "Important", accent: "text-[#d98a7a]" },
} as const;

export type CalloutKind = keyof typeof CALLOUTS;

/** Thin left rule, no filled box. Quiet by design. */
export function Callout({
  children,
  kind = "note",
}: {
  children: ReactNode;
  kind?: CalloutKind;
}) {
  const { label, accent } = CALLOUTS[kind];

  return (
    <div className="my-6 border-l-2 border-[#f3eed7]/15 pl-4">
      <div
        className={`font-mono text-[11px] uppercase tracking-[0.15em] ${accent}`}
      >
        {label}
      </div>
      <div className="mt-1.5 text-[14.5px] leading-[1.7] text-[#f3eed7]/60">
        {children}
      </div>
    </div>
  );
}

/** Back-compat alias used by existing pages. */
export function Note({
  children,
  kind = "note",
}: {
  children: ReactNode;
  kind?: "note" | "warn";
}) {
  return <Callout kind={kind}>{children}</Callout>;
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

export function Table({
  head,
  children,
}: {
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-[#f3eed7]/10">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[#f3eed7]/10 bg-[#f3eed7]/[0.03]">
            {head.map((cell, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-2.5 font-medium text-[#f3eed7]/75"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3eed7]/[0.07]">{children}</tbody>
      </table>
    </div>
  );
}

export function TR({
  children,
}: {
  children: ReactNode;
}) {
  return <tr>{children}</tr>;
}

export function TD({
  children,
  mono,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-4 py-2.5 align-top text-[#f3eed7]/60 ${
        mono ? "font-mono text-[13px] text-[#f3eed7]/75" : "leading-[1.6]"
      }`}
    >
      {children}
    </td>
  );
}

/** Two-column API reference. Sits on top of Table so styling stays shared. */
export function Props({
  items,
}: {
  items: Array<{ name: string; type?: string; desc: ReactNode }>;
}) {
  return (
    <div className="my-6 divide-y divide-[#f3eed7]/[0.07] rounded-lg border border-[#f3eed7]/10">
      {items.map((item) => (
        <div
          key={item.name}
          className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-6"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <code className="font-mono text-[13px] text-[#f3eed7]/85">
              {item.name}
            </code>
            {item.type ? (
              <span className="font-mono text-[12px] text-[#f3eed7]/35">
                {item.type}
              </span>
            ) : null}
          </div>
          <div className="text-[14px] leading-[1.65] text-[#f3eed7]/60">
            {item.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page footer ────────────────────────────────────────────────────────── */

export function DocFooter({
  prev,
  next,
}: {
  prev?: { href: string; title: string };
  next?: { href: string; title: string };
}) {
  if (!prev && !next) return null;

  return (
    <nav className="mt-16 border-t border-[#f3eed7]/10 pt-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={prev.href}
            className="group rounded-lg border border-[#f3eed7]/10 px-4 py-3 transition-colors hover:bg-[#f3eed7]/[0.03]"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#f3eed7]/30">
              ← Previous
            </span>
            <span className="mt-1 block text-[14px] text-[#f3eed7]/65 transition-colors group-hover:text-[#f3eed7]">
              {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            href={next.href}
            className="group rounded-lg border border-[#f3eed7]/10 px-4 py-3 text-right transition-colors hover:bg-[#f3eed7]/[0.03]"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#f3eed7]/30">
              Next →
            </span>
            <span className="mt-1 block text-[14px] text-[#f3eed7]/65 transition-colors group-hover:text-[#f3eed7]">
              {next.title}
            </span>
          </Link>
        ) : null}
      </div>

      <Feedback />
    </nav>
  );
}

/** Lightweight, non-functional feedback affordance. */
export function Feedback() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-[#f3eed7]/10 px-4 py-3">
      <span className="text-[13.5px] text-[#f3eed7]/45">
        Was this page helpful?
      </span>
      <span className="flex items-center gap-2">
        {["Yes", "No"].map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-md border border-[#f3eed7]/10 px-2.5 py-1 text-[12.5px] text-[#f3eed7]/55 transition-colors hover:border-[#f3eed7]/25 hover:text-[#f3eed7]/85"
          >
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}
