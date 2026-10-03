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

        <Link
          href="/docs"
          className="rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/50 transition-colors hover:text-[#f3eed7] sm:text-xs"
        >
          Docs
        </Link>
      </nav>
    </header>
  );
}
