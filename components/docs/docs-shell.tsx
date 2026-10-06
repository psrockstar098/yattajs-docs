"use client";


// components/docs/docs-shell.tsx
//
// Two-pane app shell, the dashboard pattern: the page itself never scrolls.
//
//   h-dvh overflow-hidden
//     ├─ rail   — full height, own scroll, collapsible to icons
//     └─ pane   — top bar + content, content scrolls independently
//
// Using `h-dvh overflow-hidden` rather than a sticky sidebar is the whole
// point. With `sticky`, the rail only appears once the header scrolls past and
// shares a scroll container with the article, so it can never behave like a
// real navigation column.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DocsSidebar from "./sidebar";
import TableOfContents from "./table-of-contents";
import MobileNav from "./mobile-nav";

export default function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inDocs = pathname?.startsWith("/docs");

  // The rail is always expanded: the collapse toggle was removed, so there is
  // nothing left to collapse and the state behind it is dead weight.
  const railCollapsed = false;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Rail ────────────────────────────────────────────────────────
          A real column with its own scroll context, so it stays put no
          matter how long the article gets. */}
      <section
        className={[
          "relative hidden h-full shrink-0 overflow-hidden bg-[#f3eed7]/[0.035] transition-[width] duration-300 sm:block",
          railCollapsed ? "w-12" : "w-[216px]",
        ].join(" ")}
      >
        <div className="h-[calc(100%-4rem)] overflow-y-auto overflow-x-hidden pb-6">
          <DocsSidebar collapsed={railCollapsed} />
        </div>
      </section>

      {/* ── Content pane ───────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar. Two elements only: the wordmark (narrow screens, where the
            rail is narrow too) and the docs link. */}
        <div className="h-16 shrink-0 border-b border-[#f3eed7]/[0.07] px-5 sm:px-8">
          <div className="flex h-full items-center justify-between gap-4">
            <Link
              href="/"
              className="font-bebas text-[1.6rem] leading-none tracking-wide text-[#f3eed7] transition-opacity hover:opacity-70 lg:hidden"
            >
              YATTA
            </Link>

            <div className="sm:hidden">
              <MobileNav />
            </div>

            <div className="ml-auto flex items-center gap-4">
              <Link
                href="/docs"
                aria-current={inDocs ? "page" : undefined}
                className={[
                  "rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors sm:text-xs",
                  inDocs
                    ? "text-[#f3eed7]"
                    : "text-[#f3eed7]/45 hover:text-[#f3eed7]",
                ].join(" ")}
              >
                Docs
                <Link
                  href="/compare"
                  className="rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/45 transition-colors hover:text-[#f3eed7] sm:text-xs"
                  >
                Compare
                </Link>
              </Link>
            </div>
          </div>
        </div>

        {/* Content scrolls on its own; the outline rides along inside it. */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto px-5 py-10 pb-24 sm:px-8 sm:py-14">
            <div className="mx-auto max-w-[46rem]">{children}</div>
          </main>

          <aside className="hidden w-[220px] shrink-0 overflow-y-auto border-l border-[#f3eed7]/[0.07] px-6 py-14 xl:block">
            <TableOfContents />
          </aside>
        </div>
      </section>
    </div>
  );
}
