"use client";

import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import Render_1 from "@/components/Render_1";
import Render_2 from "@/components/Render_2";
import Render_3 from "@/components/Render_3";
import Render_4 from "@/components/Render_4";
import Render_5 from "@/components/Render_5";
import Observability from "@/components/Observability";
import SiteNav from "@/components/site-nav";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      /*
      ─────────────────────────────────────────
      1. Snappy Lenis
      ─────────────────────────────────────────
      */
      const lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: !reducedMotion,
        syncTouch: false,
        wheelMultiplier: 1.0,
      });

      lenis.on("scroll", ScrollTrigger.update);
      const update = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(update);
      gsap.ticker.lagSmoothing(500, 33);

      /*
      ─────────────────────────────────────────
      2. Scroll Progress Bar
      ─────────────────────────────────────────
      */
      const progress = root.querySelector(
        "[data-scroll-progress]",
      ) as HTMLElement | null;

      if (progress) {
        gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
        ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => gsap.set(progress, { scaleX: self.progress }),
        });
      }

      /*
      ─────────────────────────────────────────
      3. CINEMATIC HIGH-RES ZOOM (With Optical Motion Blur)
      ─────────────────────────────────────────
      */
      const stage = root.querySelector("#render-3-stage");
      const logoVeil = root.querySelector("#logo-zoom-veil");
      const logoGraphic = root.querySelector("#logo-zoom-graphic");
      const lightBurst = root.querySelector("#portal-light-burst");

      if (stage && logoVeil && logoGraphic && !reducedMotion) {
        const portalTl = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: "+=150%",
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onLeave: () => {
              gsap.set(logoVeil, { display: "none" });
            },
            onEnterBack: () => {
              gsap.set(logoVeil, { display: "flex" });
            },
          },
        });

        // 1. Camera Zoom + Motion Blur
        // From scale 1 to 3 it stays sharp. Beyond scale 3 it gains optical blur.
        portalTl.fromTo(
          logoGraphic,
          {
            scale: 1,
            transformOrigin: "38% 50%",
            filter: "blur(0px) brightness(1)",
          },
          {
            scale: 14, // 14x is plenty to clear the viewport when paired with the flare
            filter: "blur(22px) brightness(1.2)", // Replaces ugly pixelation with cinematic motion blur
            ease: "power2.in",
            duration: 1,
          },
          0,
        );

        // 2. Optical Light Flare (Emerges from the runner's chest as you accelerate)
        if (lightBurst) {
          portalTl.fromTo(
            lightBurst,
            { opacity: 0, scale: 0.6 },
            {
              opacity: 0.85,
              scale: 2.2,
              ease: "power2.in",
              duration: 0.7,
            },
            0.25,
          );
        }

        // 3. Smoothly dissolve the veil as you pass through the flare into Render_3
        portalTl.fromTo(
          logoVeil,
          { opacity: 1 },
          {
            opacity: 0,
            ease: "power1.inOut",
            duration: 0.35,
          },
          0.65,
        );
      }

      /*
      ─────────────────────────────────────────
      4. Section Reveals
      ─────────────────────────────────────────
      */
      const revealSections = gsap.utils.toArray<HTMLElement>(
        "[data-page-section]:not([data-no-reveal])",
      );

      revealSections.forEach((section) => {
        if (!reducedMotion) {
          gsap.set(section, { opacity: 0, y: 28, force3D: true });
        }

        ScrollTrigger.create({
          trigger: section,
          start: "top 88%",
          once: true,
          onEnter: () => {
            if (reducedMotion) {
              gsap.set(section, { opacity: 1, y: 0 });
              return;
            }
            gsap.to(section, {
              opacity: 1,
              y: 0,
              duration: 0.65,
              ease: "power2.out",
            });
          },
        });
      });

      /*
      ─────────────────────────────────────────
      5. Scroll Velocity Skew
      ─────────────────────────────────────────
      */
      if (!reducedMotion) {
        const velocityTargets = gsap.utils.toArray<HTMLElement>(
          "[data-scroll-velocity]",
        );

        velocityTargets.forEach((element) => {
          const skewTo = gsap.quickTo(element, "skewY", {
            duration: 0.3,
            ease: "power3.out",
          });

          ScrollTrigger.create({
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            onUpdate: (self) => {
              const velocity = self.getVelocity();
              const skew = gsap.utils.clamp(-1.2, 1.2, velocity / -2000);
              skewTo(skew);
            },
          });
        });
      }

      /*
      ─────────────────────────────────────────
      6. Pointer Glow
      ─────────────────────────────────────────
      */
      const pointerGlow = root.querySelector(
        "[data-global-pointer]",
      ) as HTMLElement | null;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      let pointerHandler: ((event: MouseEvent) => void) | null = null;

      if (pointerGlow && !coarsePointer && !reducedMotion) {
        const moveX = gsap.quickTo(pointerGlow, "x", {
          duration: 0.4,
          ease: "power2.out",
        });

        const moveY = gsap.quickTo(pointerGlow, "y", {
          duration: 0.4,
          ease: "power2.out",
        });

        pointerHandler = (e: MouseEvent) => {
          moveX(e.clientX - 250);
          moveY(e.clientY - 250);
        };

        window.addEventListener("mousemove", pointerHandler, { passive: true });
      }

      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        if (pointerHandler) {
          window.removeEventListener("mousemove", pointerHandler);
        }
        gsap.ticker.remove(update);
        lenis.destroy();
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <main
      ref={rootRef}
      className="relative min-h-dvh w-full overflow-x-clip bg-[#050505] text-[#f3eed7]"
    >
      <div
        className="pointer-events-none fixed left-0 top-0 z-[100] h-[2px] w-full origin-left bg-[#f3eed7] will-change-transform"
        data-scroll-progress
      />

      <div
        data-global-pointer
        className="pointer-events-none fixed left-0 top-0 z-0 hidden h-[500px] w-[500px] rounded-full will-change-transform lg:block"
        style={{
          background:
            "radial-gradient(circle, rgba(243, 238, 215, 0.04) 0%, rgba(243, 238, 215, 0) 70%)",
        }}
      />

      {/* Persistent nav — hides on scroll-down so it never fights the pin. */}
      <SiteNav />

      <div className="relative z-10">
        {/* HERO */}
        <section data-page-section className="relative min-h-dvh">
          <Render_1 />
        </section>

        {/* 
          ═════════════════════════════════════════════
          CINEMATIC ZOOM STAGE (Render_2 into Render_3)
          ═════════════════════════════════════════════
        */}
        <div id="render-3-stage" className="relative w-full">
          <div
            id="logo-zoom-veil"
            className="pointer-events-none absolute inset-0 z-20 flex h-screen w-full items-center justify-center overflow-hidden bg-[#050505] will-change-[opacity]"
          >
            {/* Optical Flare centered on the runner */}
            <div
              id="portal-light-burst"
              className="pointer-events-none absolute h-[700px] w-[700px] rounded-full opacity-0 will-change-[transform,opacity]"
              style={{
                left: "calc(38% - 350px)",
                top: "calc(50% - 350px)",
                background:
                  "radial-gradient(circle, rgba(243, 238, 215, 0.35) 0%, rgba(243, 238, 215, 0.08) 40%, transparent 70%)",
                filter: "blur(30px)",
              }}
            />

            {/* The Logo with Motion Blur */}
            <div
              id="logo-zoom-graphic"
              className="relative w-[min(70vw,680px)] will-change-[transform,filter]"
            >
              <Render_2 />
            </div>
          </div>

          {/* RENDER 3: Clean, interactive, and full-resolution */}
          <section
            id="section-render-3"
            data-no-reveal
            className="relative z-10 min-h-screen w-full"
          >
            <Render_3 />
          </section>
        </div>

        {/* EVERYTHING INSIDE YATTA */}
        <section data-page-section className="relative">
          <Render_4 />
        </section>

        {/* OBSERVABILITY */}
        <section data-page-section className="relative">
          <Observability />
        </section>

        {/* WHY YATTA */}
        <section data-page-section className="relative">
          <Render_5 />
        </section>
      </div>
    </main>
  );
}
