"use client";

// components/docs/sidebar.tsx
//
// The rail's navigation. Every page in the docs is listed, so nothing is only
// reachable by search.
//
// Rows are compact — a 14px icon and a 13px label on one line — and keep the
// active treatment from the dashboard shell: a filled block with a thin accent
// bar across its top edge. Collapsed, the same icons stand in for the labels.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { docsNav, type NavItem, type NavSection } from "./nav";

/** Case-insensitive subsequence match, so "gtc" finds "getTopic". */
function fuzzy(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let i = 0;
  const h = haystack.toLowerCase();
  for (const ch of needle.toLowerCase()) {
    if (ch === " ") continue;
    i = h.indexOf(ch, i);
    if (i === -1) return false;
    i += 1;
  }
  return true;
}

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/docs") return false;
  return !!pathname?.startsWith(href + "/");
}

/**
 * The single href to mark current.
 *
 * The API reference lists both `/docs/api-reference` and
 * `/docs/api-reference/auth`, so a plain prefix test lights up two links at
 * once. Take the deepest href covering the current path.
 */
function activeHref(
  pathname: string | null,
  items: NavItem[],
): string | undefined {
  const covering = items.filter((i) => isActive(pathname, i.href));
  if (covering.length === 0) return undefined;
  return covering.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href;
}

export default function DocsSidebar({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, as in every framework's docs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sections = useMemo<NavSection[]>(() => {
    const q = query.trim();
    return docsNav
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) => fuzzy(q, `${i.title} ${i.blurb ?? ""}`) || fuzzy(q, i.href),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [query]);

  // ── Collapsed: icons only ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <nav aria-label="Documentation" className="flex flex-col gap-2 px-2 pt-3">
        {sections.map((s) => {
          const current = activeHref(pathname, s.items);

          return (
            <div key={s.title} className="flex flex-col gap-0.5">
              {s.items.map((item) => {
                const active = current === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "relative grid h-8 place-items-center rounded-md transition-colors",
                      active
                        ? "bg-[#f3eed7]/[0.10] text-[#f3eed7]"
                        : "text-[#f3eed7]/40 hover:bg-[#f3eed7]/[0.06] hover:text-[#f3eed7]/85",
                    ].join(" ")}
                  >
                    {active && (
                      <span className="absolute inset-x-2 top-0 h-px bg-[#f3eed7]/60" />
                    )}
                    <Icon size={15} aria-hidden />
                    <span className="sr-only">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    );
  }

  const total = docsNav.reduce((n, s) => n + s.items.length, 0);

  return (
    <nav aria-label="Documentation" className="flex flex-col">
      {/* Search */}
      <div className="px-3 pt-4 pb-1">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#f3eed7]/35"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs"
            aria-label="Search documentation"
            className="h-8 w-full rounded-md border border-[#f3eed7]/12 bg-[#f3eed7]/[0.04] pl-8 pr-8 text-[13px] text-[#f3eed7] outline-none transition-colors placeholder:text-[#f3eed7]/35 hover:border-[#f3eed7]/20 focus:border-[#f3eed7]/35"
          />

          {!query && (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#f3eed7]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#f3eed7]/35">
              /
            </kbd>
          )}
        </div>

        <p className="mt-1.5 px-0.5 font-mono text-[10px] tracking-[0.1em] text-[#f3eed7]/25">
          {query
            ? `${sections.reduce((n, s) => n + s.items.length, 0)} of ${total}`
            : `${total} pages`}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-6 pt-2">
        {sections.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-[#f3eed7]/40">
            No pages match “{query}”.
          </p>
        ) : (
          sections.map((section) => {
            const current = activeHref(pathname, section.items);
            // Open by default so the whole rail is visible at once. Searching
            // and the current page both force it open.
            const expanded =
              query || current !== undefined
                ? true
                : (open[section.title] ?? true);

            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((o) => ({ ...o, [section.title]: !expanded }))
                  }
                  aria-expanded={expanded}
                  className="group flex w-full items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-[#f3eed7]/[0.05]"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 12 12"
                    className={[
                      "h-3 w-3 shrink-0 text-[#f3eed7]/30 transition-transform duration-200",
                      expanded ? "rotate-90" : "",
                    ].join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 2.5 8 6l-3.5 3.5" />
                  </svg>

                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#f3eed7]/45 group-hover:text-[#f3eed7]/70">
                    {section.title}
                  </span>
                </button>

                {expanded && (
                  <ul className="mt-0.5 flex flex-col">
                    {section.items.map((item) => {
                      const active = current === item.href;
                      const Icon = item.icon;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            title={item.blurb}
                            aria-current={active ? "page" : undefined}
                            className={[
                              "relative flex items-center gap-2 rounded-[4px] px-2 py-[5px] text-[13px] leading-snug transition-colors",
                              active
                                ? "bg-[#f3eed7]/[0.09] font-medium text-[#f3eed7]"
                                : "text-[#f3eed7]/55 hover:bg-[#f3eed7]/[0.05] hover:text-[#f3eed7]",
                            ].join(" ")}
                          >
                            {/* Accent bar across the top edge of the active
                                block — the marker the dashboard shell uses to
                                show the current section. */}
                            {active && (
                              <span className="absolute inset-x-2.5 top-0 h-px bg-[#f3eed7]/60" />
                            )}

                            <Icon
                              size={14}
                              aria-hidden
                              className={[
                                "shrink-0",
                                active
                                  ? "text-[#f3eed7]"
                                  : "text-[#f3eed7]/40",
                              ].join(" ")}
                            />

                            <span className="truncate">{item.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
}
