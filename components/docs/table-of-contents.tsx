"use client";

// components/docs/table-of-contents.tsx
//
// Compact, quiet page outline.
//
// The list is derived from the rendered headings rather than passed in by
// each page. That keeps every doc page working without declaring its own
// outline, and means a new heading can never be missed.

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  label: string;
  depth: 2 | 3;
}

export default function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");

  // Collect headings once, after hydration. Deferred by a tick so the
  // update does not run synchronously inside the effect.
  useEffect(() => {
    const timer = setTimeout(() => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>("main h2[id], main h3[id]"),
      ).filter((el) => el.id && el.textContent?.trim());

      setItems(
        headings.map((el) => ({
          id: el.id,
          label: el.textContent!.trim(),
          depth: el.tagName === "H2" ? (2 as const) : (3 as const),
        })),
      );
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Track the section currently in view.
  useEffect(() => {
    if (items.length === 0) return;

    const byId = new Map(items.map((i) => [i.id, document.getElementById(i.id)]));

    const pick = () => {
      const offset = 100;
      let current = items[0]!.id;

      for (const item of items) {
        const el = byId.get(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = item.id;
        else break;
      }

      // At the bottom of the page, settle on the last section.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;
      if (atBottom) current = items[items.length - 1]!.id;

      setActive(current);
    };

    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="pb-8 text-[13px]">
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-[#f3eed7]/40">
        On this page
      </p>

      <ul className="space-y-1.5 border-l border-[#f3eed7]/10">
        {items.map((item) => {
          const isActive = active === item.id;

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={[
                  "-ml-px block border-l py-0.5 pl-3 leading-snug transition-colors",
                  item.depth === 3 ? "pl-6" : "",
                  isActive
                    ? "border-[#f3eed7]/70 text-[#f3eed7]/85"
                    : "border-transparent text-[#f3eed7]/40 hover:text-[#f3eed7]/70",
                ].join(" ")}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
