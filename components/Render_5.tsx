"use client";

import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

type DiagramNodeProps = {
  label: string;
  className?: string;
  active?: boolean;
};

/* ─────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────── */

const Node = ({ label, className = "", active = false }: DiagramNodeProps) => {
  return (
    <div
      data-node
      className={[
        "flex h-11 min-w-[76px] items-center justify-center",
        "border px-3 font-mono text-[9px] uppercase tracking-[0.18em]",
        "transition-colors duration-500",
        active
          ? "border-[#f3eed7]/35 bg-[#f3eed7]/10 text-[#f3eed7]"
          : "border-[#f3eed7]/10 bg-[#f3eed7]/[0.02] text-[#f3eed7]/35",
        className,
      ].join(" ")}
    >
      {label}
    </div>
  );
};

const Connector = ({ vertical = false }: { vertical?: boolean }) => {
  return (
    <div
      data-connector
      className={
        vertical ? "h-8 w-px bg-[#f3eed7]/10" : "h-px w-8 bg-[#f3eed7]/10"
      }
    />
  );
};

/* ─────────────────────────────────────────────
   Hero Architecture (Embedded Diagram)
───────────────────────────────────────────── */

const EmbeddedDiagram = () => {
  return (
    <div
      data-diagram="embedded"
      className="relative min-h-[420px] overflow-hidden border border-[#f3eed7]/10 bg-[#080807] p-6 sm:p-10"
    >
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(243,238,215,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(243,238,215,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Application boundary */}
      <div
        data-application-box
        className="absolute inset-5 border border-dashed border-[#f3eed7]/10 sm:inset-8"
      >
        <span className="absolute left-4 top-3 font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/20">
          single bun process
        </span>
      </div>

      {/* Backend */}
      <div
        data-backend-box
        className="absolute left-1/2 top-1/2 z-10 w-[min(88%,520px)] -translate-x-1/2 -translate-y-1/2 border border-[#f3eed7]/20 bg-[#0a0a09]/95 p-4 backdrop-blur-sm sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#f3eed7]/50">
            Embedded Yatta Core
          </span>

          <span
            data-status
            className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-[#f3eed7]/40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#f3eed7]/70" />
            local runtime
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[#f3eed7]/10 sm:grid-cols-4">
          {[
            "DB (WAL)",
            "AUTH",
            "STORAGE",
            "REALTIME",
            "JOBS",
            "CACHE",
            "MAIL",
            "ROUTER",
          ].map((item) => (
            <div
              key={item}
              data-service
              className="flex h-16 items-center justify-center bg-[#080807] font-mono text-[8px] tracking-[0.16em] text-[#f3eed7]/50"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Application pulse */}
      <div
        data-embedded-pulse
        className="absolute left-1/2 top-1/2 z-0 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f3eed7]/5"
      />
    </div>
  );
};

/* ─────────────────────────────────────────────
   Traditional architecture
───────────────────────────────────────────── */

const TraditionalDiagram = () => {
  return (
    <div
      data-diagram="traditional"
      className="relative min-h-[390px] overflow-hidden border border-[#f3eed7]/10 bg-[#080807] p-6 sm:p-10"
    >
      <div className="mb-8">
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
          Traditional (Microservice Cloud)
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div
          data-traditional-app
          className="flex h-14 w-48 items-center justify-center border border-[#f3eed7]/25 bg-[#f3eed7]/[0.04] font-mono text-[10px] uppercase tracking-[0.25em]"
        >
          Application
        </div>

        <Connector vertical />

        <div
          data-external-backend
          className="flex h-14 w-48 items-center justify-center border border-[#f3eed7]/15 bg-[#f3eed7]/[0.02] font-mono text-[9px] uppercase tracking-[0.2em] text-[#f3eed7]/50"
        >
          Network Hop / RPC
        </div>

        <Connector vertical />

        <div className="grid grid-cols-2 gap-px bg-[#f3eed7]/10 sm:grid-cols-4">
          {["CLOUD DB", "EXT AUTH", "S3 BUCKET", "WS GATEWAY"].map((item) => (
            <Node key={item} label={item} />
          ))}
        </div>
      </div>

      {/* Travelling request */}
      <div
        data-request
        className="absolute left-1/2 top-[82px] h-2 w-2 -translate-x-1/2 rounded-full bg-[#f3eed7] opacity-0 shadow-[0_0_20px_rgba(243,238,215,0.4)]"
      />
    </div>
  );
};

/* ─────────────────────────────────────────────
   Embedded architecture
───────────────────────────────────────────── */

const EmbeddedArchitecture = () => {
  return (
    <div
      data-diagram="architecture"
      className="relative min-h-[390px] overflow-hidden border border-[#f3eed7]/10 bg-[#080807] p-6 sm:p-10"
    >
      <div className="mb-8">
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
          Yatta (In-Process Runtime)
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div
          data-embedded-app
          className="flex h-14 w-52 items-center justify-center border border-[#f3eed7]/30 bg-[#f3eed7]/[0.06] font-mono text-[10px] uppercase tracking-[0.25em]"
        >
          Your Application
        </div>

        <Connector vertical />

        <div
          data-embedded-backend
          className="relative w-full max-w-xl border border-[#f3eed7]/25 bg-[#0b0b0a] p-4"
        >
          <div className="mb-4 font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/30">
            Bun Process &middot; Zero Network Latency
          </div>

          <div className="grid grid-cols-2 gap-px bg-[#f3eed7]/10 sm:grid-cols-4">
            {["DB (WAL)", "AUTH", "STORAGE", "REALTIME"].map((item, index) => (
              <div
                key={item}
                data-embedded-service
                className="flex h-20 items-center justify-center bg-[#080807] font-mono text-[8px] tracking-[0.2em] text-[#f3eed7]/50"
              >
                {item}
                <span className="sr-only">{index}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        data-embedded-glow
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3eed7]/[0.025] blur-[90px]"
      />
    </div>
  );
};

/* ─────────────────────────────────────────────
   Runtime Stack
───────────────────────────────────────────── */

const RuntimeStack = () => {
  const layers = [
    "API (File Router)",
    "Realtime (WS & SSE)",
    "Jobs & Queue",
    "Multi-Tier Cache",
    "Storage (S3/Local)",
    "Auth & Passkeys",
    "Database (SQLite WAL)",
  ];

  return (
    <div
      data-runtime-stack
      className="relative flex min-h-[460px] items-center justify-center overflow-hidden border border-[#f3eed7]/10 bg-[#080807] p-6"
    >
      <div className="absolute left-6 top-6">
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
          Unified Subsystem Stack
        </span>
      </div>

      <div className="relative flex w-full max-w-md flex-col gap-1">
        {layers.map((layer, index) => (
          <div
            key={layer}
            data-runtime-layer
            className="relative flex h-12 items-center justify-between border border-[#f3eed7]/10 bg-[#f3eed7]/[0.02] px-4"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#f3eed7]/45">
              {layer}
            </span>

            <span className="font-mono text-[8px] text-[#f3eed7]/15">
              0{layers.length - index}
            </span>

            <span
              data-runtime-scan
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[#f3eed7]"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Code block
───────────────────────────────────────────── */

const CodeBlock = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => {
  return (
    <div
      data-code-block
      className="overflow-hidden border border-[#f3eed7]/10 bg-[#080807]"
    >
      <div className="flex h-9 items-center justify-between border-b border-[#f3eed7]/10 px-4">
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
          {label}
        </span>

        <span className="font-mono text-[8px] text-[#f3eed7]/15">TS</span>
      </div>

      <pre className="overflow-x-auto p-5 font-mono text-[10px] leading-7 text-[#f3eed7]/55 sm:p-6 sm:text-xs">
        {children}
      </pre>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main
───────────────────────────────────────────── */

const Render_5 = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const reveal = (target: gsap.TweenTarget, vars: gsap.TweenVars = {}) => {
        if (reducedMotion) {
          gsap.set(target, { opacity: 1, y: 0, x: 0 });
          return;
        }

        gsap.fromTo(
          target,
          { opacity: 0, y: 45 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: target as Element,
              start: "top 86%",
              once: true,
            },
            ...vars,
          },
        );
      };

      /* ─────────────────────────
         General reveal
      ───────────────────────── */
      reveal("[data-reveal]");
      reveal("[data-reveal-small]", { duration: 0.8 });

      /* ─────────────────────────
         Traditional diagram
      ───────────────────────── */
      if (!reducedMotion) {
        document
          .querySelectorAll("[data-diagram='traditional']")
          .forEach((diagram) => {
            const request = diagram.querySelector("[data-request]");
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: diagram,
                start: "top 75%",
                once: true,
              },
            });

            tl.to(request, { opacity: 1, duration: 0.2 })
              .to(request, { y: 65, duration: 0.8, ease: "power2.inOut" })
              .to(request, { y: 125, duration: 0.8, ease: "power2.inOut" })
              .to(request, { opacity: 0, duration: 0.3 });

            gsap.to(diagram.querySelectorAll("[data-node]"), {
              opacity: 0.75,
              duration: 1,
              repeat: -1,
              yoyo: true,
              stagger: 0.2,
              ease: "sine.inOut",
            });
          });
      }

      /* ─────────────────────────
         Embedded architecture
      ───────────────────────── */
      if (!reducedMotion) {
        document
          .querySelectorAll("[data-diagram='architecture']")
          .forEach((diagram) => {
            const backend = diagram.querySelector("[data-embedded-backend]");
            const services = diagram.querySelectorAll(
              "[data-embedded-service]",
            );
            const glow = diagram.querySelector("[data-embedded-glow]");

            gsap.fromTo(
              backend,
              { scale: 0.94, opacity: 0.5 },
              {
                scale: 1,
                opacity: 1,
                duration: 1.4,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: diagram,
                  start: "top 78%",
                  once: true,
                },
              },
            );

            gsap.to(services, {
              backgroundColor: "rgba(243,238,215,0.06)",
              duration: 1.8,
              stagger: 0.18,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            });

            gsap.to(glow, {
              scale: 1.3,
              opacity: 0.5,
              duration: 3,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            });
          });
      }

      /* ─────────────────────────
         Runtime stack
      ───────────────────────── */
      if (!reducedMotion) {
        document.querySelectorAll("[data-runtime-stack]").forEach((stack) => {
          const scans = stack.querySelectorAll("[data-runtime-scan]");
          const layers = stack.querySelectorAll("[data-runtime-layer]");

          gsap.to(scans, {
            left: "100%",
            duration: 2.4,
            stagger: 0.3,
            repeat: -1,
            repeatDelay: 1.5,
            ease: "power1.inOut",
          });

          gsap.to(layers, {
            x: 3,
            duration: 1.5,
            stagger: 0.15,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });
      }

      /* ─────────────────────────
         Code blocks
      ───────────────────────── */
      if (!reducedMotion) {
        document.querySelectorAll("[data-code-block]").forEach((block) => {
          gsap.fromTo(
            block,
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: block,
                start: "top 88%",
                once: true,
              },
            },
          );
        });
      }

      /* ─────────────────────────
         Section heading
      ───────────────────────── */
      const heading = section.querySelector("[data-main-heading]");
      if (heading && !reducedMotion) {
        gsap.fromTo(
          heading,
          { opacity: 0, y: 70 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "power4.out",
            scrollTrigger: {
              trigger: heading,
              start: "top 82%",
              once: true,
            },
          },
        );
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#050505] text-[#f3eed7]"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-30 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#f3eed7]/[0.02] blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-28 sm:px-8 sm:py-36 lg:px-12 lg:py-44">
        {/* ═════════════════════════════════════
            01 — WHY YATTA
        ═════════════════════════════════════ */}

        <header className="max-w-6xl data-global-parallax">
          <div data-reveal-small className="mb-8 flex items-center gap-3">
            <span className="h-px w-8 bg-[#f3eed7]/40" />

            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/35">
              YATTA.JS / PHILOSOPHY
            </span>
          </div>

          <h2
            data-main-heading
            className="text-[clamp(4rem,11vw,11rem)] font-semibold leading-[0.76] tracking-[-0.08em]"
          >
            Why
            <br />
            <span className="text-[#f3eed7]/30">Yatta?</span>
          </h2>

          <div
            data-reveal
            className="mt-14 grid grid-cols-1 gap-8 border-t border-[#f3eed7]/10 pt-8 lg:grid-cols-12"
          >
            <p className="data-scroll-velocity text-xl leading-relaxed tracking-tight text-[#f3eed7]/70 sm:text-2xl lg:col-span-7 lg:text-3xl">
              Modern application development often means assembling and paying
              for six independent cloud services before writing a single line of
              business logic.
            </p>

            <p className="data-scroll-velocity text-sm leading-7 text-[#f3eed7]/35 sm:text-base lg:col-span-4 lg:col-start-9">
              Yatta takes a radically different approach: engineered natively on
              Bun, the database, auth, storage, realtime, and queues compile
              directly into your application process with zero external brokers.
            </p>
          </div>
        </header>

        {/* ═════════════════════════════════════
            02 — INFRASTRUCTURE LIST
        ═════════════════════════════════════ */}

        <div
          data-reveal
          className="mt-24 grid grid-cols-2 border-y border-[#f3eed7]/10 sm:grid-cols-3 lg:grid-cols-4"
        >
          {[
            "SQLite WAL Engine",
            "Passkeys & MFA Auth",
            "RFC 9110 Storage",
            "Typed File Routing",
            "Native WebSockets",
            "Durable Job Queues",
            "Multi-Tier SWR Cache",
            "Transactional Mailer",
          ].map((item, index) => (
            <div
              key={item}
              className="group flex min-h-28 flex-col justify-between border-b border-r border-[#f3eed7]/10 p-5 transition-colors duration-500 hover:bg-[#f3eed7]/[0.025] sm:min-h-32 sm:p-6"
            >
              <span className="font-mono text-[8px] text-[#f3eed7]/20">
                0{index + 1}
              </span>

              <span className="text-sm text-[#f3eed7]/55 transition-colors group-hover:text-[#f3eed7]/80">
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* ═════════════════════════════════════
            03 — INSTALL THE BACKEND
        ═════════════════════════════════════ */}

        <div className="mt-40">
          <div data-reveal className="mb-12 max-w-3xl">
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/25">
              THE DIFFERENCE
            </span>

            <h3 className="mt-6 text-4xl font-medium leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Install the backend
              <br />
              <span className="text-[#f3eed7]/30">
                instead of provisioning it.
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <CodeBlock label="terminal">
              <span className="text-[#f3eed7]/30">$</span>{" "}
              <span className="text-[#f3eed7]">bun add</span>{" "}
              <span className="text-[#f3eed7]/75">yatta</span>
              {"\n\n"}
              <span className="text-[#f3eed7]/35">
                # boots SQLite WAL, Passkeys, S3 storage, and queues
              </span>
              {"\n"}
              <span className="text-[#f3eed7]/60">
                ✓ [yatta-db] SQLite WAL initialized
              </span>
              {"\n"}
              <span className="text-[#f3eed7]/60">
                ✓ [yatta-jobs] Worker pool active
              </span>
              {"\n"}
              <span className="text-[#f3eed7]/60">
                ✓ [realtime] Native WebSockets &amp; SSE ready
              </span>
              {"\n"}
              <span className="text-[#f3eed7]/30">
                → Server ready in <span className="text-[#f3eed7]">9ms</span>
              </span>
            </CodeBlock>

            <div data-reveal className="max-w-xl">
              <p className="text-lg leading-8 text-[#f3eed7]/55 sm:text-xl">
                Your application gets all required production infrastructure
                embedded directly inside the native Bun runtime.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "No external Redis, Postgres, or Kafka broker instances required.",
                  "Zero cold-start delay — initializes in under 10ms.",
                  "Full data ownership on local NVMe or edge disks.",
                  "Seamless S3/R2 switch when you need object scale.",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-4">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[#f3eed7]/50" />
                    <span className="text-sm text-[#f3eed7]/40">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════
            04 — WHAT MAKES DIFFERENT
        ═════════════════════════════════════ */}

        <div className="mt-48">
          <div data-reveal className="mb-16">
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/25">
              ARCHITECTURE
            </span>

            <h3 className="mt-6 text-4xl font-medium tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Where the
              <br />
              <span className="text-[#f3eed7]/30">backend lives.</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[#f3eed7]/10 lg:grid-cols-2">
            <div>
              <TraditionalDiagram />
            </div>

            <div>
              <EmbeddedArchitecture />
            </div>
          </div>

          <div
            data-reveal
            className="mt-10 flex flex-col gap-4 border-l border-[#f3eed7]/20 pl-6 sm:pl-8"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#f3eed7]/25">
              THE FUNDAMENTAL DIFFERENCE
            </span>

            <p className="max-w-3xl text-xl leading-relaxed text-[#f3eed7]/60 sm:text-2xl">
              The backend becomes part of your application’s memory space and
              process boundary instead of an array of remote network hops.
            </p>
          </div>
        </div>

        {/* ═════════════════════════════════════
            05 — ONE RUNTIME
        ═════════════════════════════════════ */}

        <div className="mt-48">
          <div
            data-reveal
            className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
          >
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/25">
                ONE RUNTIME
              </span>

              <h3 className="mt-6 text-4xl font-medium tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                One installation.
                <br />
                <span className="text-[#f3eed7]/30">One runtime.</span>
              </h3>
            </div>

            <p className="max-w-md text-sm leading-7 text-[#f3eed7]/35 sm:text-base">
              Instead of stitching together multiple infrastructure products,
              your application operates as a coherent, self-contained system.
            </p>
          </div>

          <RuntimeStack />

          <div
            data-reveal
            className="mt-10 grid grid-cols-2 gap-px border border-[#f3eed7]/10 bg-[#f3eed7]/10 sm:grid-cols-3 lg:grid-cols-6"
          >
            {[
              "Single Process",
              "Self-Hosting",
              "Local Dev First",
              "Data Ownership",
              "Offline Ready",
              "Bun Native",
            ].map((item) => (
              <div
                key={item}
                className="flex min-h-24 items-end bg-[#050505] p-5"
              >
                <span className="text-sm text-[#f3eed7]/40">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═════════════════════════════════════
            06 — MORE THAN DATABASE
        ═════════════════════════════════════ */}

        <div className="mt-48">
          <div data-reveal className="max-w-4xl">
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/25">
              COHESIVE PLATFORM
            </span>

            <h3 className="mt-6 text-4xl font-medium leading-[0.9] tracking-[-0.06em] sm:text-6xl lg:text-8xl">
              The database is
              <br />
              <span className="text-[#f3eed7]/30">only the beginning.</span>
            </h3>
          </div>

          <div className="data-global-parallax mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            {/* Embedded Diagram showcasing local runtime */}
            <EmbeddedDiagram />

            <div data-reveal className="lg:pl-10">
              <p className="text-xl leading-8 text-[#f3eed7]/55 sm:text-2xl">
                Yatta is not simply an embedded database with an API wrapper
                around it.
              </p>

              <p className="data-scroll-velocity mt-6 text-sm leading-7 text-[#f3eed7]/35 sm:text-base">
                The database, authentication tokens, file storage, realtime
                WebSockets, and background queues share the same memory space,
                same lifecycle, and same TypeScript declaration registry.
              </p>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════
            07 — BUILT FOR DEVELOPERS
        ═════════════════════════════════════ */}

        <div className="mt-48">
          <div data-reveal className="mb-16">
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/25">
              DEVELOPER EXPERIENCE
            </span>

            <h3 className="mt-6 text-4xl font-medium tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              The infrastructure
              <br />
              <span className="text-[#f3eed7]/30">should disappear.</span>
            </h3>
          </div>

          <div className="space-y-px bg-[#f3eed7]/10">
            <CodeBlock label="database &amp; api">
              <span className="text-[#f3eed7]/35">import</span>{" "}
              <span className="text-[#f3eed7]">{"{ DB, API }"}</span>{" "}
              <span className="text-[#f3eed7]/35">from</span>{" "}
              <span className="text-[#f3eed7]/60">&quot;yatta&quot;</span>;
              {"\n\n"}
              <span className="text-[#f3eed7]/35">export default</span>{" "}
              <span className="text-[#f3eed7]">API</span>
              <span className="text-[#f3eed7]/40">(&quot;/users&quot;)</span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.get</span>
              <span className="text-[#f3eed7]/40">(async () =&gt; {"{"}</span>
              {"\n    "}
              <span className="text-[#f3eed7]/35">return</span>{" "}
              <span className="text-[#f3eed7]">DB.users.where</span>
              <span className="text-[#f3eed7]/40">
                (f =&gt; f.email.endsWith(
              </span>
              <span className="text-[#f3eed7]/60">
                &quot;@yatta.local&quot;
              </span>
              <span className="text-[#f3eed7]/40">)).all();</span>
              {"\n  "}
              <span className="text-[#f3eed7]/40">{"}"});</span>
            </CodeBlock>

            <CodeBlock label="authentication &amp; passkeys">
              <span className="text-[#f3eed7]/35">import</span>{" "}
              <span className="text-[#f3eed7]">{"{ auth }"}</span>{" "}
              <span className="text-[#f3eed7]/35">from</span>{" "}
              <span className="text-[#f3eed7]/60">&quot;yatta&quot;</span>;
              {"\n\n"}
              <span className="text-[#f3eed7]/35">const</span>{" "}
              <span className="text-[#f3eed7]">result</span>{" "}
              <span className="text-[#f3eed7]/25">=</span>{" "}
              <span className="text-[#f3eed7]/35">await</span>{" "}
              <span className="text-[#f3eed7]">auth.signIn</span>
              <span className="text-[#f3eed7]/40">({"{"}</span>
              {"\n  "}
              <span className="text-[#f3eed7]/40">email,</span>
              {"\n  "}
              <span className="text-[#f3eed7]/40">password,</span>
              {"\n  "}
              <span className="text-[#f3eed7]/40">req</span>
              {"\n"}
              <span className="text-[#f3eed7]/40">{"}"});</span>
              {"\n\n"}
              <span className="text-[#f3eed7]/25">
                {"// Returns session, JWT, Argon2id & MFA tokens"}
              </span>
            </CodeBlock>

            <CodeBlock label="storage &amp; rfc 9110 partial streaming">
              <span className="text-[#f3eed7]/35">import</span>{" "}
              <span className="text-[#f3eed7]">{"{ Storage, API }"}</span>{" "}
              <span className="text-[#f3eed7]/35">from</span>{" "}
              <span className="text-[#f3eed7]/60">&quot;yatta&quot;</span>;
              {"\n\n"}
              <span className="text-[#f3eed7]/35">export default</span>{" "}
              <span className="text-[#f3eed7]">API</span>
              <span className="text-[#f3eed7]/40">
                (&quot;/media/[name]&quot;)
              </span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.get</span>
              <span className="text-[#f3eed7]/40">((ctx) =&gt; {"{"}</span>
              {"\n    "}
              <span className="text-[#f3eed7]/25">
                {"// Smart HTTP 206 Partial Content & 304 caching"}
              </span>
              {"\n    "}
              <span className="text-[#f3eed7]/35">return</span>{" "}
              <span className="text-[#f3eed7]">Storage.file</span>
              <span className="text-[#f3eed7]/40">
                (ctx.params.name).serve(ctx.req);
              </span>
              {"\n  "}
              <span className="text-[#f3eed7]/40">{"}"});</span>
            </CodeBlock>

            <CodeBlock label="durable background jobs &amp; events">
              <span className="text-[#f3eed7]/35">import</span>{" "}
              <span className="text-[#f3eed7]">{"{ Jobs, events }"}</span>{" "}
              <span className="text-[#f3eed7]/35">from</span>{" "}
              <span className="text-[#f3eed7]/60">&quot;yatta&quot;</span>;
              {"\n\n"}
              <span className="text-[#f3eed7]/35">await</span>{" "}
              <span className="text-[#f3eed7]">Jobs.job</span>
              <span className="text-[#f3eed7]/40">(</span>
              <span className="text-[#f3eed7]/60">&quot;send-email&quot;</span>
              <span className="text-[#f3eed7]/40">)</span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.with</span>
              <span className="text-[#f3eed7]/40">
                ({"{"} to: user.email, subject: &quot;Welcome&quot; {"}"})
              </span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.delay</span>
              <span className="text-[#f3eed7]/40">(</span>
              <span className="text-[#f3eed7]/60">&quot;10m&quot;</span>
              <span className="text-[#f3eed7]/40">)</span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.priority</span>
              <span className="text-[#f3eed7]/40">(</span>
              <span className="text-[#f3eed7]/60">&quot;high&quot;</span>
              <span className="text-[#f3eed7]/40">)</span>
              {"\n  "}
              <span className="text-[#f3eed7]/50">.save</span>
              <span className="text-[#f3eed7]/40">();</span>
            </CodeBlock>
          </div>
        </div>

        {/* ═════════════════════════════════════
            08 — CLOSING
        ═════════════════════════════════════ */}

        <div
          data-reveal
          className="mt-48 border-t border-[#f3eed7]/10 pt-10 sm:mt-60"
        >
          <div className="data-global-parallax grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="text-3xl leading-[1.05] tracking-[-0.045em] text-[#f3eed7]/75 sm:text-5xl lg:text-6xl">
                The goal is not to hide complexity forever.
              </p>

              <p className="data-scroll-velocity mt-8 max-w-3xl text-lg leading-8 text-[#f3eed7]/35 sm:text-xl">
                It is to provide a sensible default so developers can focus on
                building their application instead of assembling infrastructure.
              </p>
            </div>

            <div className="flex items-end justify-start lg:col-span-3 lg:col-start-10">
              <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-[#f3eed7]/20">
                YATTA / 002
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Render_5;
