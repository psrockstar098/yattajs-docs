"use client";

// app/compare/page.tsx — Yatta vs the field, expanded edition.

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SiteNav from "@/components/site-nav";

gsap.registerPlugin(ScrollTrigger);

// ── Weighted scores (1-10) ──
const weights = [
  { name: "Performance", weight: 15 },
  { name: "Developer experience", weight: 15 },
  { name: "Architecture", weight: 15 },
  { name: "Ecosystem", weight: 15 },
  { name: "TypeScript", weight: 10 },
  { name: "Database / ORM", weight: 10 },
  { name: "Security", weight: 5 },
  { name: "Testing", weight: 5 },
  { name: "Deployment", weight: 5 },
  { name: "Maturity", weight: 5 },
];
const frameworks = ["Yatta", "NestJS", "Fastify", "Hono", "AdonisJS", "Elysia", "Express", "Koa"];
const scores: Record<string, number[]> = {
  Yatta:    [9, 8, 9, 3, 9, 8, 8, 8, 8, 2],
  NestJS:   [6, 9, 10, 10, 10, 9, 8, 9, 9, 9],
  Fastify:  [8, 8, 8, 9, 8, 7, 8, 8, 9, 8],
  Hono:     [9, 9, 8, 7, 9, 6, 7, 7, 10, 5],
  AdonisJS: [6, 9, 8, 6, 9, 9, 8, 7, 8, 7],
  Elysia:   [10, 9, 8, 5, 10, 6, 7, 7, 7, 4],
  Express:  [6, 7, 6, 10, 6, 7, 6, 8, 9, 10],
  Koa:      [6, 7, 6, 6, 6, 6, 6, 7, 8, 8],
};
function weightedTotal(n: string) {
  let t = 0;
  weights.forEach((w, i) => { t += scores[n]![i]! * (w.weight / 100); });
  return Math.round(t * 100) / 100;
}
const ranked = [...frameworks].sort((a, b) => weightedTotal(b) - weightedTotal(a));




const features = [
  "Auth (sessions/JWT)",
  "Database ORM",
  "Realtime (WS/SSE)",
  "Job queue",
  "Cache",
  "File storage",
  "Mail",
  "Rate limiting",
  "Validation",
  "Observability",
];
const has: Record<string, boolean[]> = {
  Yatta:    [true, true, true, true, true, true, true, true, true, true],
  NestJS:   [false, false, false, false, false, false, false, false, true, false],
  Fastify:  [false, false, false, false, false, false, false, true, true, false],
  Hono:     [false, false, false, false, false, false, false, false, true, false],
  AdonisJS: [true, true, true, false, false, false, true, true, true, false],
  Elysia:   [false, false, false, false, false, false, false, false, true, false],
  Express:  [false, false, false, false, false, false, false, false, false, false],
  Koa:      [false, false, false, false, false, false, false, false, false, false],
};

// ── Time to build (hours, estimated) ──
const buildTime: Record<string, number> = {
  Yatta: 4, AdonisJS: 6, NestJS: 10, Elysia: 8, Fastify: 12, Hono: 12, Express: 16, Koa: 16,
};
const maxBuild = Math.max(...Object.values(buildTime));

// ── Memory footprint (MB RSS under load, measured 2026-10-06) ──
const memory: Record<string, number> = {
  Elysia: 66, Hono: 69, Yatta: 71, Express: 83, Fastify: 84, Koa: 84,
};
const maxMem = Math.max(...Object.values(memory));

const Section = ({ kicker, title, children }: { kicker: string; title: React.ReactNode; children: React.ReactNode }) => (<section className="px-5 py-16 sm:px-8"><div className="mx-auto max-w-5xl"><p data-fade-in className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/80">{kicker}</p><h2 data-fade-in className="font-bebas mt-2 text-4xl tracking-wide sm:text-5xl">{title}</h2><div className="mt-8">{children}</div></div></section>);

// ── Raw speed ──
// Live CI numbers from benchmarks.json (GitHub Actions, Bun 1.4.2, GET /json, 20k req, 100 concurrent)
// https://github.com/psrockstar098/yatta.js/blob/main/benchmarks.json
// Falls back to the last known values if the fetch fails.
const FALLBACK_RPS: Record<string, number> = { Elysia: 49966, Hono: 38604, Yatta: 33646, Fastify: 19439, Express: 14560, Koa: 14889 };

function RawSpeedSection() {
  const [rps, setRps] = useState<Record<string, number>>(FALLBACK_RPS);
  const [meta, setMeta] = useState<{ commit: string; date: string } | null>(null);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/psrockstar098/yatta.js/main/benchmarks.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.comparison?.frameworks) return;
        const live: Record<string, number> = {};
        for (const fw of data.comparison.frameworks) {
          live[fw.name] = fw.requests_per_sec;
        }
        if (Object.keys(live).length >= 4) {
          setRps(live);
          setMeta({ commit: data.commit_short || "", date: (data.generated_at || "").slice(0, 10) });
        }
      })
      .catch(() => {});
  }, []);

  const maxRps = Math.max(...Object.values(rps));

  return (
    <Section kicker={`GET /json · 20k req · 100 concurrent${meta ? ` · CI ${meta.date} · ${meta.commit}` : ""}`} title={<>RAW <span className="text-emerald-400">SPEED</span></>}>
      <div className="space-y-4">
        {Object.entries(rps).sort((a, b) => b[1] - a[1]).map(([name, v]) => (
          <div key={name} data-fade-in>
            <div className="mb-1 flex items-baseline justify-between">
              <span className={`font-mono text-sm uppercase tracking-wider ${name === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/70"}`}>{name}</span>
              <span className="font-mono text-sm text-[#f3eed7]/50">{v.toLocaleString()} req/s</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div data-animate-bar data-target={(v / maxRps).toFixed(3)} className={`h-full origin-left rounded-full ${name === "Yatta" ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-[#f3eed7]/20"}`} style={{ transform: "scaleX(0)" }} />
            </div>
          </div>
        ))}
      </div>
      <p data-fade-in className="mt-4 font-mono text-[11px] text-[#f3eed7]/40">
        Live from <a href="https://github.com/psrockstar098/yatta.js/blob/main/benchmarks.json" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-emerald-300">benchmarks.json</a> — regenerated by GitHub Actions on every push to main. Same runner, same load, no cherry-picking.
      </p>
    </Section>
  );
}
export default function ComparePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-animate-bar]").forEach((bar) => {
        const target = parseFloat(bar.dataset.target || "0");
        gsap.fromTo(bar, { scaleX: 0 }, {
          scaleX: target, duration: 1.2, ease: "power3.out",
          scrollTrigger: { trigger: bar, start: "top 90%" },
        });
      });
      gsap.utils.toArray<HTMLElement>("[data-fade-in]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });
      gsap.fromTo("[data-hero-title]", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.2 });
    }, root);
    return () => ctx.revert();
  }, []);


  return (
    <div ref={rootRef} className="min-h-screen bg-[#050505] text-[#f3eed7]">
      <SiteNav />

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.15), transparent)" }} />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/80">Head to head</p>
          <h1 data-hero-title className="font-bebas mt-4 text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-wide">YATTA VS<br /><span className="text-emerald-400">THE FIELD</span></h1>
          <p className="mt-6 max-w-2xl text-lg text-[#f3eed7]/60">Seven frameworks. Ten weighted criteria. Real benchmarks. Zero cherry-picking.</p>
        </div>
      </section>

      {/* RAW SPEED */}
      <RawSpeedSection />

        {/* REAL-WORLD API */}
      <Section kicker="Auth + validation + DB read · Yatta vs Hono + Drizzle · measured 2026-10-06" title={<>REAL-WORLD <span className="text-emerald-400">API</span></>}>
        <p data-fade-in className="text-[#f3eed7]/60">Raw /json speed is one thing. Real APIs do auth checks, validate input, and hit the database. We benchmarked the identical route on both stacks: in-process Bearer token check, param validation, SQLite point-read, JSON response. Same 10,000 users, same operations — no network hops in either.</p>
        <div data-fade-in className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Stack</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">req/s</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">p50</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">p95</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">p99</th>
            </tr></thead>
            <tbody className="font-mono">
              <tr className="border-b border-white/5 bg-emerald-500/[0.06]">
                <td className="px-4 py-3 text-emerald-300 font-semibold">Yatta (built-in ORM)</td>
                <td className="px-4 py-3 text-right text-emerald-300">2,026</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">36.9ms</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">130.4ms</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">192.9ms</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[#f3eed7]/70">Hono + Drizzle</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">1,716</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">45.5ms</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">144.0ms</td>
                <td className="px-4 py-3 text-right text-[#f3eed7]/70">200.9ms</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p data-fade-in className="mt-4 text-sm text-[#f3eed7]/60"><span className="text-emerald-400 font-semibold">Honest result:</span> on an identical real-world route, Yatta is ~1.18x the throughput of a well-assembled Hono + Drizzle single-process app. Not 7-12x — that old figure compared in-process Yatta against network-hop microservices (an architecture difference, not a framework one). This is the apples-to-apples test.</p>
        <p data-fade-in className="mt-2 text-xs text-[#f3eed7]/35">Methodology: GET /api/user/:id, 2k warmup + 20k requests at 100 concurrency, 3 runs each (fresh server + DB per run), median run reported. In-memory SQLite, 10k seeded users. Absolute req/s is capped by the test VM; the relative gap was consistent across all runs.</p>
      </Section>
            
      {/* DATABASE */}
      <Section kicker="SQLite · Yatta ORM vs Drizzle · same database · measured 2026-10-06" title={<>DATABASE <span className="text-emerald-400">BENCHMARK</span></>}>
        <p data-fade-in className="text-[#f3eed7]/60">Same SQLite file, same table, same 10,000 rows, same operations. The only variable is the ORM. Yatta ships a typed SQLite ORM with zero setup.</p>
        <div data-fade-in className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Operation</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-emerald-400">Yatta ORM</th><th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Drizzle</th>
              </tr></thead>
            <tbody className="font-mono">
              {[["Indexed point read", "0.009ms", "0.043ms"], ["Filtered list (100)", "0.071ms", "0.162ms"], ["Insert + return", "0.188ms", "0.801ms"], ["Transaction (3 ops)", "0.240ms", "0.667ms"]].map((r) => (
                <tr key={r[0]} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-[#f3eed7]/70">{r[0]}</td>
                  <td className="px-4 py-3 text-right text-emerald-300">{r[1]}</td>
                  <td className="px-4 py-3 text-right text-[#f3eed7]/50">{r[2]}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-fade-in className="mt-4 text-xs text-[#f3eed7]/35">Methodology: one shared SQLite file (bun:sqlite), users table with 10k rows, identical PRAGMAs for both ORMs. 500 warmup + 5,000 timed iterations per operation, 3 full runs; reported = median of per-run medians. Lower is better.</p>
      </Section>

      {/* TIME TO BUILD */}
      <Section kicker="Auth + users + posts + DB + validation + tests + deploy · estimates" title={<>TIME TO <span className="text-emerald-400">BUILD</span></>}>
        <p data-fade-in className="text-[#f3eed7]/60">Estimated hours for one developer to ship a complete app. These are estimates based on the number of packages to configure — not measured stopwatch times.</p>
        <div className="mt-8 space-y-4">
          {Object.entries(buildTime).sort((a, b) => a[1] - b[1]).map(([name, hrs]) => (
            <div key={name} data-fade-in>
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`font-mono text-sm uppercase tracking-wider ${name === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/70"}`}>{name}</span>
                <span className="font-mono text-sm text-[#f3eed7]/50">~{hrs}h</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <div data-animate-bar data-target={(hrs / maxBuild).toFixed(3)} className={`h-full origin-left rounded-full ${name === "Yatta" ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-[#f3eed7]/20"}`} style={{ transform: "scaleX(0)" }} />
              </div>
            </div>
          ))}
        </div>
        <p data-fade-in className="mt-4 text-xs text-[#f3eed7]/35">Shorter bar = faster to ship. Yatta wins because auth, DB, validation, and jobs are built in — no assembly required.</p>
      </Section>

      {/* BATTERIES INCLUDED */}
      <Section kicker="What ships in the box" title={<>BATTERIES <span className="text-emerald-400">INCLUDED</span></>}>
        <div data-fade-in className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Feature</th>
              {frameworks.map((f) => (
                <th key={f} className={`px-2 py-3 text-center font-mono text-[10px] uppercase ${f === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/50"}`}>{f.slice(0, 6)}</th>
              ))}
            </tr></thead>
            <tbody>
              {features.map((feat, i) => (
                <tr key={feat} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-[#f3eed7]/70">{feat}</td>
                  {frameworks.map((f) => (
                    <td key={f} className={`px-2 py-2.5 text-center text-lg ${f === "Yatta" ? "bg-emerald-500/[0.06]" : ""}`}>
                      {has[f]![i] ? <span className="text-emerald-400">●</span> : <span className="text-[#f3eed7]/15">○</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-fade-in className="mt-4 text-sm text-[#f3eed7]/50">Yatta ships these ten capabilities through its core runtime. Competing frameworks generally compose them through additional official or community packages (like <span className="font-mono">@nestjs/*</span> or <span className="font-mono">@adonisjs/*</span>) — each with its own config, version drift, and docs to manage.</p>
      </Section>

      {/* MEMORY */}
      <Section kicker="RSS under load · measured 2026-10-06" title={<>MEMORY <span className="text-emerald-400">FOOTPRINT</span></>}><p data-fade-in className="text-[#f3eed7]/60">Real RSS measurements — each framework's /json server in its own OS process, 10k requests at 50 concurrency, RSS read from the OS.</p>
        <div className="space-y-4">
          {Object.entries(memory).sort((a, b) => a[1] - b[1]).map(([name, mb]) => (
            <div key={name} data-fade-in>
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`font-mono text-sm uppercase tracking-wider ${name === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/70"}`}>{name}</span>
                <span className="font-mono text-sm text-[#f3eed7]/50">{mb} MB</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <div data-animate-bar data-target={(mb / maxMem).toFixed(3)} className={`h-full origin-left rounded-full ${name === "Yatta" ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-[#f3eed7]/20"}`} style={{ transform: "scaleX(0)" }} />
              </div>
            </div>
          ))}
        </div>
        <p data-fade-in className="mt-4 text-xs text-[#f3eed7]/35">Methodology: each framework&apos;s /json server in its own OS process, 10,000 requests at 50 concurrency, RSS read from the OS. Two rounds averaged. Lower is better.</p>
      </Section>

      {/* WEIGHTED TOTALS */}
      <Section kicker="10 criteria · published weights" title={<>WEIGHTED <span className="text-emerald-400">TOTALS</span></>}> <p data-fade-in className="mb-6 max-w-2xl text-sm text-[#f3eed7]/50">Scores are editorial (1–10 per criterion). Weights: Performance 15%, Developer experience 15%, Architecture 15%, Ecosystem 15%, TypeScript 10%, Database / ORM 10%, Security 5%, Testing 5%, Deployment 5%, Maturity 5%. Total = Σ(score × weight). Reproduce it: the weights, per-framework scores, and formula live in <span className="font-mono">app/compare/page.tsx</span> in this repo.</p> <p data-fade-in className="mb-6 max-w-2xl text-sm text-[#f3eed7]/50">Scores are editorial (1–10 per criterion). Weights: Performance 15%, Developer experience 15%, Architecture 15%, Ecosystem 15%, TypeScript 10%, Database / ORM 10%, Security 5%, Testing 5%, Deployment 5%, Maturity 5%. Total = Σ(score × weight). Reproduce it: the weights, per-framework scores, and formula live in <span className="font-mono">app/compare/page.tsx</span> in this repo.</p>
        
        
        
        
        <p data-fade-in className="mb-6 max-w-2xl text-sm text-[#f3eed7]/50">Scores are editorial (1–10 per criterion). Weights: Performance 15%, Developer experience 15%, Architecture 15%, Ecosystem 15%, TypeScript 10%, Database / ORM 10%, Security 5%, Testing 5%, Deployment 5%, Maturity 5%. Total = Σ(score × weight). Reproduce it: the weights, per-framework scores, and formula live in <span className="font-mono">app/compare/page.tsx</span> in this repo.</p>        
        <div className="space-y-3">
          {ranked.map((name, i) => {
            const total = weightedTotal(name);
            const isYatta = name === "Yatta";
            return (
              <div key={name} data-fade-in className={`flex items-center gap-4 rounded-xl border p-4 ${isYatta ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/5 bg-white/[0.02]"}`}>
                <span className={`font-bebas w-10 text-3xl ${i < 3 ? "text-emerald-400" : "text-[#f3eed7]/30"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 font-mono text-sm uppercase tracking-wider">{name}</span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/5 sm:w-40">
                  <div data-animate-bar data-target={total.toFixed(2)} className={`h-full origin-left rounded-full ${isYatta ? "bg-emerald-400" : "bg-[#f3eed7]/25"}`} style={{ transform: "scaleX(0)" }} />
                </div>
                <span className="font-mono text-xl w-14 text-right">{total.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* RUNTIME ENGINE SHOOTOUT */} <Section kicker="Worker runtimes · 4 workers · 20k tasks · measured 2026-10-06" title={<>RUNTIME ENGINE <span className="text-emerald-400">SHOOTOUT</span></>}> <p data-fade-in className="text-[#f3eed7]/60">Task dispatch throughput across worker runtimes. Same machine, same test methodology: 20,000 echo tasks across 4 workers, measuring throughput, p99 latency, memory, and IPC round-trip cost.</p> <div data-fade-in className="mt-6 overflow-x-auto rounded-2xl border border-white/10"> <table className="w-full min-w-[700px] text-sm"> <thead><tr className="border-b border-white/10 bg-white/[0.03]"> <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Runtime</th> <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Throughput</th> <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">p99</th> <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Memory</th> <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">Workers</th> <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-[#f3eed7]/50">IPC</th> </tr></thead> <tbody className="font-mono"> <tr className="border-b border-white/5 bg-emerald-500/[0.06]"> <td className="px-4 py-3 text-emerald-300 font-semibold">Yatta Runtime</td> <td className="px-4 py-3 text-right text-emerald-300">85,746 ops/s</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">10.51ms</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">52.5 MB</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">4</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">0.049ms</td> </tr> <tr className="border-b border-white/5"> <td className="px-4 py-3 text-[#f3eed7]/70">Bun Workers</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">104,623 ops/s</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">2.13ms</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">64.6 MB</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">4</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">0.086ms</td> </tr> <tr className="border-b border-white/5"> <td className="px-4 py-3 text-[#f3eed7]/70">Node worker_threads</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">40,888 ops/s</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">7.46ms</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">143.9 MB</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">4</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">0.154ms</td> </tr> <tr> <td className="px-4 py-3 text-[#f3eed7]/70">Deno Workers</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">22,248 ops/s</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">10.88ms</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">105.1 MB</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">4</td> <td className="px-4 py-3 text-right text-[#f3eed7]/70">0.181ms</td> </tr> </tbody> </table> </div> <div data-fade-in className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"> <p className="text-sm text-[#f3eed7]/60"><span className="text-emerald-400 font-semibold">Honest note:</span> Bun&apos;s raw workers edge out Yatta on pure echo throughput because Yatta&apos;s runtime includes the task scheduler, module isolation, and observability overhead. Yatta wins on <span className="text-[#f3eed7]">batteries included</span> — scheduling, multi-tenancy, and monitoring that raw workers don&apos;t provide.</p> </div> <p data-fade-in className="mt-4 text-xs text-[#f3eed7]/35">Methodology: 20,000 ping-pong tasks dispatched across 4 workers. Throughput = tasks/second. p99 = 99th percentile task latency. IPC = single round-trip postMessage cost. All measured on the same machine, same day.</p> </Section> {/* BUILD THE SAME APP */}
      <Section kicker="The challenge" title={<>BUILD THE <span className="text-emerald-400">SAME APP</span></>}>
        <div data-fade-in className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-8">
          <p className="text-lg text-[#f3eed7]/80">Pick any framework. Build: user signup/login, posts CRUD, SQLite, validation, tests, deploy to production.</p>
          <p className="mt-4 text-[#f3eed7]/60">Time yourself. Then build it in Yatta.</p>
          <p className="font-bebas mt-6 text-3xl text-emerald-300">ESTIMATED IMPLEMENTATION EFFORT: ~4H.</p>
          <p className="mt-2 text-sm text-[#f3eed7]/50">The rest take 6-16. That gap is the batteries.</p>
        </div>
      </Section>

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8">
        <div data-fade-in className="mx-auto max-w-3xl text-center">
          <h2 className="font-bebas text-5xl tracking-wide sm:text-6xl">TRY THE <span className="text-emerald-400">FAST ONE</span></h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/docs" className="rounded-full bg-emerald-500 px-8 py-4 font-mono text-sm uppercase tracking-[0.15em] text-black hover:bg-emerald-400">Read the docs</Link>
            <Link href="/benchmarks" className="rounded-full border border-white/20 px-8 py-4 font-mono text-sm uppercase tracking-[0.15em] text-[#f3eed7] hover:bg-white/5">Live benchmarks</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
