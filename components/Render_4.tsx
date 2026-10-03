"use client";

import React from "react";
import Image from "next/image";

const features = [
  {
    number: "01",
    title: "Bun Native by Design",
    description:
      "Built directly on Bun’s C and Zig primitives — bun:sqlite with WAL mode, Bun.password Argon2id, and native WebSockets for maximum throughput.",
    visual: "image",
    image: "/speed.gif",
  },
  {
    number: "02",
    title: "Everything in One Runtime",
    description:
      "Relational DB, Auth with Passkeys & MFA, S3/Local Storage, Realtime WebSockets, Durable Queues, and Mail — unified in a single process.",
    visual: "runtime",
  },
  {
    number: "03",
    title: "Instant Startup & Zero Bloat",
    description:
      "No Docker orchestration or external broker services needed to get started. Boots in under 10ms with zero runtime overhead.",
    visual: "terminal",
  },
  {
    number: "04",
    title: "Zero-Codegen Type Safety",
    description:
      "100% end-to-end schema autocompletion via ambient declaration merging. No Prisma CLI or slow build-step generation required.",
    visual: "code",
  },
  {
    number: "05",
    title: "English-Language Fluent DSL",
    description:
      "Expressive, natural APIs like DB.users.where(), Storage.file().serve(req), and Mail.to().deliver() that read like spoken English.",
    visual: "image",
    image: "/c1.png",
  },
  {
    number: "06",
    title: "Zero-Config Observability",
    description:
      "Auto-instrumented observability for your yatta applications. Distributed tracing, auto-correlated logs, request and job metrics — out of the box.",
    visual: "runtime",
  },
  {
    number: "07",
    title: "Hardened Enterprise Security",
    description:
      "Token Family replay defense, AES-256-GCM at rest, RFC 9110 HTTP 206 streaming, and non-destructive magic-byte verification.",
    visual: "architecture",
  },
];

const FeatureVisual = ({ type, image }: { type: string; image?: string }) => {
  if (type === "image" && image) {
    return (
      <div className="relative h-full min-h-[260px] w-full overflow-hidden bg-[#0a0a09]">
        <Image
          src={image}
          alt="Yatta Performance Feature"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
      </div>
    );
  }

  if (type === "runtime") {
    const modules = ["DB", "AUTH", "STORAGE", "REALTIME", "JOBS", "CACHE"];
    return (
      <div className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden bg-[#0a0a09]">
        {/* Orbits */}
        <div className="absolute h-48 w-48 rounded-full border border-[#f3eed7]/10" />
        <div className="absolute h-32 w-32 rounded-full border border-[#f3eed7]/15" />

        {/* Center Engine Core */}
        <div className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border border-[#f3eed7]/30 bg-[#f3eed7] text-[#050505] shadow-[0_0_80px_rgba(243,238,215,0.12)]">
          <span className="font-mono text-[11px] font-bold tracking-wider">
            YATTA
          </span>
          <span className="font-mono text-[7px] uppercase tracking-widest text-[#050505]/60">
            core
          </span>
        </div>

        {/* Orbiting Modules */}
        {modules.map((mod, i) => {
          const angle = (i * 360) / modules.length;
          const rad = (angle * Math.PI) / 180;
          const radius = 86;
          const x = Math.round(radius * Math.cos(rad));
          const y = Math.round(radius * Math.sin(rad));

          return (
            <div
              key={mod}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className="absolute z-20 flex h-6 items-center justify-center border border-[#f3eed7]/25 bg-[#080807] px-2 font-mono text-[7px] uppercase tracking-[0.18em] text-[#f3eed7]/75 backdrop-blur-sm"
            >
              {mod}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "terminal") {
    return (
      <div className="flex min-h-[260px] items-center justify-center bg-[#0a0a09] p-6">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#f3eed7]/10 bg-[#080807] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#f3eed7]/10 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-[#f3eed7]/20" />
            <span className="h-2 w-2 rounded-full bg-[#f3eed7]/20" />
            <span className="h-2 w-2 rounded-full bg-[#f3eed7]/20" />
            <span className="ml-auto font-mono text-[9px] text-[#f3eed7]/25">
              bun — yatta runtime
            </span>
          </div>

          <div className="space-y-1.5 p-5 font-mono text-xs leading-6">
            <p className="text-[#f3eed7]/35">
              <span className="text-[#f3eed7]/70">$</span> bun run src/server.ts
            </p>
            <p className="text-[#f3eed7]/40">
              <span className="text-[#f3eed7]/70">✓</span> [db] SQLite WAL
              initialized (app.db)
            </p>
            <p className="text-[#f3eed7]/40">
              <span className="text-[#f3eed7]/70">✓</span> [jobs] Worker pool
              active (concurrency: 5)
            </p>
            <p className="text-[#f3eed7]/40">
              <span className="text-[#f3eed7]/70">✓</span> [realtime] Native
              WebSockets &amp; SSE ready
            </p>
            <p className="pt-2 text-[#f3eed7]/80">
              → running at{" "}
              <span className="underline decoration-[#f3eed7]/40">
                http://localhost:4000
              </span>{" "}
              <span className="text-[#f3eed7]/40">(9ms)</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "code") {
    return (
      <div className="flex min-h-[260px] items-center overflow-x-auto bg-[#0a0a09] p-6 font-mono text-[11px] leading-6">
        <div className="w-full">
          <div>
            <span className="text-[#f3eed7]/20">01</span>{" "}
            <span className="text-[#f3eed7]/45">import</span>{" "}
            <span className="text-[#f3eed7]">{"{ DB, API }"}</span>{" "}
            <span className="text-[#f3eed7]/45">from</span>{" "}
            <span className="text-[#f3eed7]/70">&quot;yatta&quot;</span>;
          </div>
          <div>
            <span className="text-[#f3eed7]/20">02</span>
            {"\n"}
          </div>
          <div>
            <span className="text-[#f3eed7]/20">03</span>{" "}
            <span className="text-[#f3eed7]/45">export default</span>{" "}
            <span className="text-[#f3eed7]">API</span>(
            <span className="text-[#f3eed7]/70">&quot;/users/[id]&quot;</span>)
          </div>
          <div>
            <span className="text-[#f3eed7]/20">04</span>
            {"  "}
            <span className="text-[#f3eed7]/45">.get</span>(
            <span className="text-[#f3eed7]/45">async</span> (ctx) =&gt; {"{"}
          </div>
          <div>
            <span className="text-[#f3eed7]/20">05</span>
            {"    "}
            <span className="text-[#f3eed7]/45">const</span> user ={" "}
            <span className="text-[#f3eed7]">await</span>{" "}
            DB.users.findById(ctx.params.id);
          </div>
          <div>
            <span className="text-[#f3eed7]/20">06</span>
            {"    "}
            <span className="text-[#f3eed7]/45">return</span> API.json(user);
          </div>
          <div>
            <span className="text-[#f3eed7]/20">07</span>
            {"  "}
            {"}"});
          </div>
          <div className="mt-3 text-[#f3eed7]/25">
              {"// Full autocomplete without code generation"}
            </div>
        </div>
      </div>
    );
  }

  if (type === "architecture") {
    return (
      <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#0a0a09] p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-28 items-center justify-center border border-[#f3eed7]/15 bg-[#080807] font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/40">
              Bun Core
            </div>
            <span className="font-mono text-xs text-[#f3eed7]/20">→</span>
            <div className="flex h-12 w-32 items-center justify-center border border-[#f3eed7]/35 bg-[#f3eed7]/[0.08] font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3eed7]">
              Yatta Engine
            </div>
            <span className="font-mono text-xs text-[#f3eed7]/20">→</span>
            <div className="flex h-11 w-28 items-center justify-center border border-[#f3eed7]/15 bg-[#080807] font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/40">
              Your App
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <span className="border border-dashed border-[#f3eed7]/15 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[#f3eed7]/35">
              Argon2id
            </span>
            <span className="border border-dashed border-[#f3eed7]/15 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[#f3eed7]/35">
              SQLite WAL
            </span>
            <span className="border border-dashed border-[#f3eed7]/15 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[#f3eed7]/35">
              RFC 9110
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const Render_4 = () => {
  return (
    <section className="relative w-full overflow-hidden bg-[#050505] text-[#f3eed7]">
      {/* Background grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-40 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#f3eed7]/[0.025] blur-[140px]" />

      <div className="relative mx-auto w-full max-w-[1500px] px-5 py-24 sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        {/* Header */}
        <header className="mb-16 sm:mb-20 lg:mb-24">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-8 bg-[#f3eed7]/40" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/35">
                  YATTA.JS / ARCHITECTURE
                </span>
              </div>

              <h2 className="max-w-4xl text-[clamp(3rem,7vw,7rem)] font-semibold leading-[0.82] tracking-[-0.07em]">
                Everything
                <br />
                <span className="text-[#f3eed7]/30">inside Yatta.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-[#f3eed7]/40 sm:text-base lg:pb-2">
              The entire backend stack — database, auth, storage, realtime, jobs,
              mail, and observability — embedded inside your application runtime.
            </p>
          </div>

          {/* Divider */}
          <div className="mt-12 h-px w-full bg-[#f3eed7]/10" />
        </header>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-[#f3eed7]/10 bg-[#f3eed7]/10 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="group relative flex min-h-[500px] flex-col bg-[#050505] transition-colors duration-500 hover:bg-[#090908]"
            >
              {/* Visual preview */}
              <div className="relative overflow-hidden border-b border-[#f3eed7]/10">
                <FeatureVisual type={feature.visual} image={feature.image} />
                <div className="absolute left-5 top-5 z-10">
                  <span className="font-mono text-[10px] tracking-[0.25em] text-[#f3eed7]/35">
                    {feature.number}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <h3 className="max-w-sm text-2xl font-medium tracking-[-0.035em] text-[#f3eed7] sm:text-3xl">
                    {feature.title}
                  </h3>

                  <p className="mt-5 max-w-sm text-sm leading-7 text-[#f3eed7]/40">
                    {feature.description}
                  </p>
                </div>

                {/* Footer anchor */}
                <div className="mt-12 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#f3eed7]/20">
                    Capabilities
                  </span>

                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f3eed7]/10 text-[#f3eed7]/40 transition-all duration-300 group-hover:border-[#f3eed7]/30 group-hover:bg-[#f3eed7] group-hover:text-[#050505]">
                    ↗
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom banner */}
        <div className="mt-24 flex flex-col gap-6 border-t border-[#f3eed7]/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-3xl text-2xl leading-tight tracking-tight text-[#f3eed7]/70 sm:text-3xl lg:text-4xl">
            Backend infrastructure should feel like part of your application,
            not an independent cloud you have to stitch together.
          </p>

          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
            YATTA / 001
          </span>
        </div>
      </div>
    </section>
  );
};

export default Render_4;
