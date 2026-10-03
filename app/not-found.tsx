import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#050505] px-6 text-center text-[#f3eed7]">
      <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#f3eed7]/35">
        404
      </span>

      <h1 className="mt-4 text-[clamp(2rem,6vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
        Page not found
      </h1>

      <p className="mt-4 max-w-md text-[15px] leading-[1.7] text-[#f3eed7]/50">
        That page does not exist. It may have moved, or the link may be
        mistyped.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-md border border-[#f3eed7]/15 px-4 py-2 text-[14px] text-[#f3eed7]/75 transition-colors hover:bg-[#f3eed7]/[0.05] hover:text-[#f3eed7]"
        >
          Back home
        </Link>

        <Link
          href="/docs"
          className="rounded-md border border-[#f3eed7]/15 px-4 py-2 text-[14px] text-[#f3eed7]/75 transition-colors hover:bg-[#f3eed7]/[0.05] hover:text-[#f3eed7]"
        >
          Browse the docs
        </Link>
      </div>
    </div>
  );
}
