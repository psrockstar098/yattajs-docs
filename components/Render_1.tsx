import Link from "next/link";
import React from "react";

const Render_1 = () => {
  return (
    <div className="relative min-h-dvh w-dvw overflow-hidden bg-black text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover scale-105"
        autoPlay
        muted
        playsInline
        loop
        src="/run.mp4"
      />

      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.7)_100%)]" />

      {/* Content */}
      <main className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center px-6 py-20 text-center">
        {/* Hero heading */}
        <h1
          className="
        max-w-[1400px]
        font-dash
        text-[clamp(4.5rem,10vw,11rem)]
        leading-[0.78]
        tracking-[-0.04em]
        text-logo-cream-dark
      "
        >
          Your Backend.
          <br />
          <span className="text-[#f3eed7]/35">Inside Your App.</span>
        </h1>

        <div className="mt-10 flex max-w-4xl flex-col items-center gap-5">
          <p
            className="
          max-w-3xl
          font-bebas
          text-[clamp(1.5rem,3vw,3rem)]
          leading-[0.95]
          tracking-wide
          text-logo-cream/90
        "
          >
            Build full-stack applications without provisioning a separate
            backend server.
          </p>

          <p
            className="
          max-w-2xl
          font-sans
          text-sm
          leading-relaxed
          text-[#f3eed7]/50
          sm:text-base
        "
          >
            Yatta gives your application a built-in backend runtime with
            database, authentication, mail, storage, APIs, background jobs,
            realtime communication, and built-in observability.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={"/docs"}
            className="
          rounded-full
          border
          border-white/15
          bg-white/5
          px-7
          py-3
          font-mono
          text-sm
          text-white/80
          backdrop-blur-xl
          transition
          hover:bg-white/10
        "
          >
            Read the Docs
          </Link>
        </div>

        <div className="absolute bottom-8 left-0 right-0 overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-3 whitespace-nowrap text-xs font-mono uppercase tracking-[0.2em] text-logo-cream-dark/30">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span>Embedded Database</span>
                <span>•</span>
                <span>Authentication</span>
                <span>•</span>
                <span>File Storage</span>
                <span>•</span>
                <span>Realtime</span>
                <span>•</span>
                <span>Background Jobs</span>
                <span>•</span>
                <span>Authorization</span>
                <span>•</span>
                <span>Embedded cache</span>
                <span>•</span>
                <span>Events</span>
                <span>•</span>
                <span>CLI</span>
                <span>•</span>
                <span>More</span>
                <span>•</span>
                <span>Backups</span>
                <span>•</span>
                <span>Queues</span>
                <span>•</span>
                <span>Huge List</span>
                <span>•</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Render_1;
