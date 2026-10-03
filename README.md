# yatta-docs

Marketing and documentation site for [Yatta](https://github.com/yatta-dev/yatta) — a production-grade backend framework for [Bun](https://bun.com).

Built with Next.js 16 (App Router, Turbopack), Tailwind CSS v4, GSAP + ScrollTrigger, and Lenis for smooth scrolling.

## Getting started

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Does |
|---------|------|
| `bun run dev` | Development server with hot reload |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |

## Structure

```
app/
  layout.tsx        Root layout — registers local fonts (Bebas Neue, Roboto, Dash)
  page.tsx          Landing page; orchestrates scroll choreography
  docs/             One directory per subsystem (observe, db, auth, jobs, …)
  globals.css       Theme tokens, fonts, animations
  fonts/            Self-hosted font files
components/
  header.tsx        Site navigation
  Observability.tsx Landing section for the observability feature grid
  Render_1..5.tsx   Landing page sections
public/             Images and video
```

### Landing page sections

| Component | Section |
|-----------|---------|
| `Render_1` | Hero |
| `Render_2` | Logo (zoomed through, inside `Render_3`'s pinned stage) |
| `Render_3` | "What is Yatta.js?" |
| `Render_4` | Feature grid |
| `Render_5` | Philosophy, architecture, code examples |
| `Observability` | Observability feature grid — every card states Shipped or Planned |

## Notes

- Scroll animations use GSAP `ScrollTrigger` inside a `gsap.context()` scoped to the section root, so `ctx.revert()` cleans up cleanly on unmount.
- `prefers-reduced-motion` is respected throughout — animation-heavy paths are skipped rather than merely shortened.
- `Render_2` is rendered inside a pinned "portal" stage with a scale + blur transition; changing the zoom timeline means editing `app/page.tsx`.
- In `components/Observability.tsx` the Shipped/Planned badge is load-bearing, not decoration: a card may only be marked shipped once the capability exists in the framework. Removing a "Planned" badge means the feature actually shipped — check `src/types/observe.ts` before doing so.

## Docs conventions

- Every code sample in `app/docs/` is written against a real API. If a sample
  references a method that does not exist, the docs are wrong — not the method.
- Prefer documenting a refusal over a promise. Where an engine declines to
  produce a result because the data is insufficient, that behaviour is
  documented as deliberately, because it is the part a reader will otherwise
  discover by accident.
