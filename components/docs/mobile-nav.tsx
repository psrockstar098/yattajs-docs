"use client";

// components/docs/mobile-nav.tsx
//
// Slide-over navigation for narrow screens, where the desktop rail is hidden.
//
// Superseded by the always-present rail in docs-shell.tsx, which collapses to
// icons on narrow screens instead of hiding behind a button. Kept as a
// fallback and renders the same DocsSidebar so the two cannot drift.

import { useEffect, useState } from "react";
import DocsSidebar from "./sidebar";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  // Lock scroll while open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open documentation menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-[#f3eed7]/12 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-[#f3eed7]/60 transition-colors hover:border-[#f3eed7]/25 hover:text-[#f3eed7] lg:hidden"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M1 3h12M1 7h12M1 11h12"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        Menu
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col overflow-y-auto border-r border-[#f3eed7]/10 bg-[#050505] px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/40">
                Documentation
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-[#f3eed7]/50 hover:text-[#f3eed7]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Same rail as the desktop sidebar, so the two can never drift. */}
            <DocsSidebar />
          </div>
        </div>
      ) : null}
    </>
  );
}
