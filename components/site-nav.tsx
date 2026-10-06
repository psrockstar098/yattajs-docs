"use client";

// components/site-nav.tsx
//
// Fixed navigation for the marketing landing page.
//
// The landing page is full-bleed with a pinned scroll stage, so this overlay
// deliberately avoids touching layout: it floats above, and hides while
// scrolling down so it never competes with the animation.
//
// Two elements only — wordmark and a link to the docs — matching the docs
// header. The landing page has no section navigation of its own: each section
// is a full-bleed panel you scroll to, so a menu would duplicate the page.

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SiteNav() {
  const [hidden, setHidden] = useState(false);
  const [past, setPast] = useState(false);

  useEffect(() => {
    let last = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      setPast(y > 24);

      // Hide on downward scroll past the hero, reveal on upward.
      if (y > 200 && y > last + 4) setHidden(true);
      else if (y < last - 4) setHidden(false);

      last = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
        hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
        past
          ? "border-b border-[#f3eed7]/10 bg-[#050505]/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <nav className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="font-bebas text-2xl leading-none tracking-wide text-[#f3eed7] transition-opacity hover:opacity-70"
        >
          YATTA
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="https://github.com/psrockstar098/yatta.js"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Yatta on GitHub"
            className="flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/50 transition-colors hover:text-[#f3eed7] sm:text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            GitHub
          </a>
          <Link
            href="/docs"
            className="rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/50 transition-colors hover:text-[#f3eed7] sm:text-xs"
          >
            Docs
          </Link>
          <Link
            href="/compare"
            className="rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/50 transition-colors hover:text-[#f3eed7] sm:text-xs"
          >
            Compare
          </Link>
        </div>
      </nav>
    </header>
  );
}
