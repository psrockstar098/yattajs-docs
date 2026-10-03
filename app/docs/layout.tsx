import type { Metadata } from "next";
import type { ReactNode } from "react";
import DocsShell from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "Docs — YATTA",
  description:
    "Guides and API reference for Yatta: the Bun backend framework with a hardware-aware worker runtime, typed SQLite ORM, auth, jobs, cache, storage, mail and realtime.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-hidden bg-[#050505] text-[#f3eed7]">
      <DocsShell>{children}</DocsShell>
    </div>
  );
}
