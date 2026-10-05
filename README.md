# yatta-docs

Marketing and documentation site for [Yatta](https://github.com/psrockstar098/yatta.js) — a production-grade backend framework for [Bun](https://bun.com).

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
| `bun run build` | Checks the API reference is current, then production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run extract:api` | Regenerate `lib/api-surface.json` from the framework source |
| `bun run check:api` | Fail if `lib/api-surface.json` has drifted from the framework |

The framework lives in a sibling checkout (`../Yatta`, overridable as the first
argument to both api scripts). `bun run build` runs `check:api` first, so a
missing extract is a build failure instead of a page that quietly publishes last
month's signatures.

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

## Keeping this in step with the framework

This site is generated and hand-written from the framework's source, so it goes
stale the moment either moves. The framework repo has the full mapping in its
`AGENTS.md`; the short version:

| Changed in the framework | Do here |
|---|---|
| An exported symbol, signature or doc comment | `bun run extract:api`, commit `lib/api-surface.json` |
| A new module | Add it to `scripts/extract-api.mjs` MODULES **and** `lib/api.ts` META, add an icon in `components/docs/nav.ts` MODULE_ICONS, then extract |
| A new feature | A page in `app/docs/`, an entry in `components/docs/nav.ts`, one in `app/sitemap.ts` |
| A bug a user would notice | The page describing the old behaviour — that claim is now false |
| The framework README | The matching docs page |

Two rules that matter more than the rest:

- The site is ahead of the framework less harmfully than behind it. Publishing a
  page for behaviour that does not exist is worse than omitting one.
- A limitation stated plainly is a feature of the documentation. Silently
  dropping a "Planned" card because the feature looked easy reads as
  availability.
- "Typechecked" is not "works". `/docs/frontend` names which framework bindings
  were verified by rendering, which only as logic, and which only by the
  compiler. Keep that split current — a page that implies all nine are equally
  verified is the kind of claim that erodes trust in the rest.

## Docs conventions

- Every code sample in `app/docs/` is written against a real API. If a sample
  references a method that does not exist, the docs are wrong — not the method.
- Every code sample is checked against a real compiler. A snippet that type-checks
  nowhere is worse than no snippet, and nobody can tell by reading it.
- Prefer documenting a refusal over a promise. Where an engine declines to
  produce a result because the data is insufficient, that behaviour is
  documented as deliberately, because it is the part a reader will otherwise
  discover by accident.
