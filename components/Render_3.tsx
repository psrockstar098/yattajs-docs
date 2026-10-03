import React from "react";

const Render_3 = () => {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden bg-[#050505] text-[#f3eed7]">
      {/* Subtle texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E")
          `,
        }}
      />

      {/* Soft glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[45vw] w-[45vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-logo-cream-dark blur-[300px]" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
        {/* Top */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#f3eed7]/40 sm:text-xs">
            YATTA.JS
          </span>

          <span className="font-mono text-[10px] tracking-[0.2em] text-[#f3eed7]/30 sm:text-xs">
            01 / 04
          </span>
        </div>

        {/* Main */}
        <div className="py-20">
          <div className="mb-8 flex items-center gap-4">
            <span className="h-px w-8 bg-[#f3eed7]/40" />

            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/40">
              The Runtime
            </span>
          </div>

          <h1 className="max-w-6xl text-[clamp(3.8rem,10vw,10rem)] font-semibold leading-[0.78] tracking-[-0.075em]">
            What is
            <br />
            <span className="text-[#f3eed7]/35">Yatta.js?</span>
          </h1>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* Main statement */}
            <div className="lg:col-span-7">
              <p className="max-w-4xl text-xl leading-relaxed tracking-tight text-[#f3eed7]/75 sm:text-2xl lg:text-3xl">
                A backend that lives{" "}
                <span className="text-[#f3eed7]">inside your application.</span>
              </p>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-[#f3eed7]/40 sm:text-base sm:leading-8">
                Yatta handles the backend work so you can focus on building the
                things that matter. Less infrastructure. Less boilerplate. More
                application.
              </p>
            </div>

            {/* Side information */}
            <div className="lg:col-span-4 lg:col-start-9">
              <div className="border-l border-[#f3eed7]/10 pl-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f3eed7]/35">
                  Philosophy
                </p>

                <p className="mt-5 text-sm leading-7 text-[#f3eed7]/50">
                  Yatta.js is designed to make backend development feel natural
                  — giving you powerful primitives and useful features without
                  forcing you to manage unnecessary complexity.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col gap-4 border-t border-[#f3eed7]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#f3eed7]/25">
            Built on Bun
          </span>

          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#f3eed7]/25">
            JS / TS → Zig / WASM
          </span>
        </div>
      </div>
    </section>
  );
};

export default Render_3;
