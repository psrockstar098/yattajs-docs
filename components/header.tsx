// components/header.tsx
import Link from "next/link";

/**
 * Two elements, matching the docs header: the wordmark and a link to the
 * docs. The landing page has no section navigation of its own — each section
 * is a full-bleed panel that you scroll to — so a menu here would only ever
 * duplicate the page below it.
 */
const header = () => {
  return (
    <nav className="flex w-full items-center justify-between px-2 py-2 leading-none text-nowrap">
      {/* Brand returns to the top of the landing page. */}
      <Link
        href="/"
        prefetch={true}
        className="font-bebas select-none text-[clamp(1.5rem,2vw,3rem)] tracking-wide text-[#f3eed7] transition-opacity hover:opacity-70"
      >
        YATTA
      </Link>

      <Link
        href="/docs"
        prefetch={true}
        className="rounded-md px-2 py-1 font-mono text-[11px] tracking-[0.2em] text-[#f3eed7]/50 uppercase transition-colors hover:text-[#f3eed7] sm:text-xs"
      >
        Docs
      </Link>
    </nav>
  );
};

export default header;
