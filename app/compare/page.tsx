"use client";

// app/compare/page.tsx
//
// Yatta vs the field — weighted framework comparison in Yatta's visual language.
// Dark, cinematic, animated. Scores are 1-10 per criterion.

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SiteNav from "@/components/site-nav";

gsap.registerPlugin(ScrollTrigger);

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

const benchmarkRps: Record<string, number> = {
  Yatta: 16180,
  Elysia: 17595,
  Hono: 16042,
  Fastify: 11291,
  Express: 8457,
  Koa: 7093,
};

function weightedTotal(name: string): number {
  const s = scores[name]!;
  let total = 0;
  weights.forEach((w, i) => {
    total += s[i]! * (w.weight / 100);
  });
  return Math.round(total * 100) / 100;
}

const ranked = [...frameworks].sort((a, b) => weightedTotal(b) - weightedTotal(a));
const maxRps = Math.max(...Object.values(benchmarkRps));

export default function ComparePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-animate-bar]").forEach((bar) => {
        const target = parseFloat(bar.dataset.target || "0");
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: target / 10,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: { trigger: bar, start: "top 90%" },
          }
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-fade-in]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
          }
        );
      });

      gsap.fromTo("[data-hero-title]", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.2 });
      gsap.fromTo("[data-hero-sub]", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 0.4 });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-[#050505] text-[#f3eed7]">
      <SiteNav />
      <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.15), transparent)" }} />
        <div className="relative mx-auto max-w-5xl">
          <p data-hero-sub className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/80">Head to head</p>
          <h1 data-hero-title className="font-bebas mt-4 text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-wide">YATTA VS<br /><span className="text-emerald-400">THE FIELD</span></h1>
          <p data-hero-sub className="mt-6 max-w-2xl text-lg text-[#f3eed7]/60">An honest, weighted comparison against seven popular backend frameworks. No cherry-picking — the scores punish Yatta where it deserves it.</p>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 data-fade-in className="font-bebas text-4xl tracking-wide sm:text-5xl">RAW SPEED</h2>
          <p data-fade-in className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-[#f3eed7]/40">GET /json · 20,000 requests · 100 concurrent</p>
          <div className="mt-10 space-y-4">
            {Object.entries(benchmarkRps).sort((a, b) => b[1] - a[1]).map(([name, rps]) => (
              <div key={name} data-fade-in>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className={`font-mono text-sm uppercase tracking-wider ${name === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/70"}`}>{name}{name === "Yatta" && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">this framework</span>}</span>
                  <span className="font-mono text-sm text-[#f3eed7]/50">{rps.toLocaleString()} req/s</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div data-animate-bar data-target={((rps / maxRps) * 10).toFixed(2)} className={`h-full origin-left rounded-full ${name === "Yatta" ? "bg-gradient-to-r from-emerald-500 to-emerald-300" : "bg-[#f3eed7]/20"}`} style={{ transform: "scaleX(0)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 data-fade-in className="font-bebas text-4xl tracking-wide sm:text-5xl">WEIGHTED TOTALS</h2>
          <div className="mt-10 space-y-3">
            {ranked.map((name, i) => {
              const total = weightedTotal(name);
              const isYatta = name === "Yatta";
              return (
                <div key={name} data-fade-in className={`flex items-center gap-4 rounded-xl border p-4 ${isYatta ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/5 bg-white/[0.02]"}`}>
                  <span className={`font-bebas text-3xl w-10 ${i < 3 ? "text-emerald-400" : "text-[#f3eed7]/30"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-mono text-sm uppercase tracking-wider">{name}{isYatta && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">this framework</span>}</span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-white/5 sm:w-40">
                    <div data-animate-bar data-target={total.toFixed(2)} className={`h-full origin-left rounded-full ${isYatta ? "bg-emerald-400" : "bg-[#f3eed7]/25"}`} style={{ transform: "scaleX(0)" }} />
                  </div>
                  <span className="font-mono text-xl w-14 text-right">{total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 data-fade-in className="font-bebas text-4xl tracking-wide sm:text-5xl">FULL BREAKDOWN</h2>
          <div data-fade-in className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-4 text-left font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]/50">Criterion</th>
                {frameworks.map((f) => (<th key={f} className={`px-3 py-4 text-center font-mono text-[11px] uppercase tracking-wider ${f === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]/50"}`}>{f}</th>))}
              </tr></thead>
              <tbody>
                {weights.map((w, i) => (
                  <tr key={w.name} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><span className="text-[#f3eed7]/80">{w.name}</span><span className="ml-2 font-mono text-[10px] text-[#f3eed7]/35">{w.weight}%</span></td>
                    {frameworks.map((f) => {
                      const s = scores[f]![i]!;
                      const color = s >= 9 ? "text-emerald-400" : s >= 7 ? "text-lime-300" : s >= 5 ? "text-amber-300" : "text-red-400";
                      return <td key={f} className={`px-3 py-3 text-center font-mono text-base ${color} ${f === "Yatta" ? "bg-emerald-500/[0.06]" : ""}`}>{s}</td>;
                    })}
                  </tr>
                ))}
                <tr className="bg-white/[0.04]">
                  <td className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3eed7]">Total</td>
                  {frameworks.map((f) => (<td key={f} className={`px-3 py-4 text-center font-mono text-lg ${f === "Yatta" ? "text-emerald-400" : "text-[#f3eed7]"}`}>{weightedTotal(f).toFixed(2)}</td>))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 data-fade-in className="font-bebas text-4xl tracking-wide sm:text-5xl">WHERE YATTA <span className="text-emerald-400">WINS</span></h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Performance — 9/10", body: "16,180 req/s. 1.9x Express, 1.4x Fastify, within 8% of Elysia. Bun-native, zero Node overhead." },
              { title: "Architecture — 9/10", body: "Auth, realtime, jobs, cache, storage, mail, observability, worker runtime — all in-process." },
              { title: "Database — 8/10", body: "Built-in SQLite ORM with migrations. Zero setup." },
              { title: "TypeScript — 9/10", body: "First-class, strict, end-to-end typed." },
            ].map((c) => (
              <div key={c.title} data-fade-in className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6">
                <h3 className="font-mono text-sm uppercase tracking-[0.15em] text-emerald-300">{c.title}</h3>
                <p className="mt-3 text-[#f3eed7]/60">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
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
