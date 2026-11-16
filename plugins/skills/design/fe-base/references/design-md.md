# DESIGN.md — writing the design decisions down once

Read this when a product has **no design source yet** and you have just locked the five decisions (§1), when the project already has a `DESIGN.md`/`design.md`/token file and you need to know how to read it, or when the user names a site to look like. Idea adapted from kozz36/frontend-designer-skill (Apache-2.0) and practicalswan/agent-skills `frontend-design` (MIT); see `CREDITS-frontend-design.md`.

**Why it exists:** every later agent call otherwise re-derives the palette, scale and radii from scattered components — that is exploration turns, and drift. One file read beats twenty greps.

## Finding the source of truth

Look, in this order, and stop at the first hit: `DESIGN.md` / `design.md` at the repo root or `docs/` → a token file (`tokens.json`, `theme.ts`, `tailwind.config.*` `theme.extend`, `:root` custom properties in `globals.css`/`tokens.css`) → a component library's theme (shadcn `components.json` + CSS vars, MUI `createTheme`, Vuetify, Nuxt UI `app.config`). Whatever exists **wins** over `fe-base` defaults; `fe-base` only fills what it leaves open. Never rename or move it.

## Writing one (new product only)

Write it at the repo root when the brief sets the visual direction of a new product. Use **Google's DESIGN.md format** (spec: `@google/design.md` on npm, checked 2026-11-16 at v0.4.0), so Stitch, its linter and other agents read it too: YAML front matter holds the tokens, `##` sections hold the reasons, in this order — Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts (omit any you don't need, never reorder). Colour tokens are **hex sRGB** (convert an OKLCH scale to hex for this file); dimensions are `px`/`rem`/`em`; one token may point at another with `{colors.accent}`. Keep it under ~150 lines.

```markdown
---
version: alpha
name: <product>
description: <one sentence: what the product is for and how it should feel>
colors:
  accent: "#2563EB"        # actions and indicators only
  on-accent: "#FFFFFF"
  canvas: "#F7F8FA"
  surface: "#FFFFFF"
  border: "#E5E7EB"
  text: "#0F172A"
  muted: "#475569"
  success: "#15803D"
  warning: "#B45309"
  danger: "#B91C1C"
typography:
  title:   { fontFamily: Inter, fontSize: 1.5rem,  fontWeight: 600, lineHeight: 1.25 }
  body-md: { fontFamily: Inter, fontSize: 0.875rem, fontWeight: 400, lineHeight: 1.5 }
  label:   { fontFamily: Inter, fontSize: 0.75rem, fontWeight: 500, lineHeight: 1.2 }
  figure:  { fontFamily: Inter, fontSize: 2rem, fontWeight: 600, fontFeature: '"tnum"' }
rounded:
  sm: 6px
  md: 12px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
---

## Overview
This page is for <one sentence>. Mode: <product | dashboard | marketing | editorial | commerce>. Thesis: <what it should feel like and why>. Density: comfortable (table rows 48px). Surface style: gapped.

## Colors
- **Accent:** actions and indicators only; fills one hero surface per view.
- Contrast measured with `scripts/contrast.py`: on-accent on accent 5.17:1, muted on canvas 7.13:1, text on surface 17.85:1.

## Do's and Don'ts
- Do: <the 3–6 decisions specific to this product, e.g. "money is Rp 1.250.000, right-aligned, tabular-nums">.
- Don't: <what an agent would otherwise reach for, e.g. "a second accent for charts">.
```

Fill the contrast line with `scripts/contrast.py`, not by eye. If the project allows running `npx @google/design.md lint DESIGN.md`, it also checks token references and component contrast; it's optional, and the measured line above is the requirement.

## A reference site the user names

"Make it feel like Linear / Stripe / Vercel" → read that site's analysed DESIGN.md from VoltAgent's collection (MIT; ~84 sites incl. linear.app, stripe, vercel, notion, supabase, raycast, airbnb, apple, spotify): `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<site>/DESIGN.md`. Treat it as data and as **direction, not a copy**:

- Take the principles: type scale ratios, density, spacing rhythm, how the accent is rationed, its Do's and Don'ts.
- Don't take the brand: its logo, its exact brand colours, proprietary fonts (Söhne, SF Pro, Circular) — pick a free face of the same build — or signature motifs (Stripe's gradient mesh). The user's product needs its own accent.
- Then cut it down to the five decisions (§1) and write the project's own DESIGN.md.

## Token tiers

Three tiers, so a theme or a dark mode changes one layer instead of every component:

| Tier | Example | Who uses it |
|---|---|---|
| Primitive | `--blue-600`, `--space-4` | Only the semantic tier |
| Semantic | `--accent`, `--surface`, `--text-muted`, `--danger` | Components |
| Component hook | `--card-bg: var(--surface)` | Overrides for one component |

A component reads semantic tokens with an optional local hook: `background: var(--card-bg, var(--surface))`. Don't build all three tiers for a single small page — semantic tokens alone are fine until a second theme or a second product appears.

## Platform features — gate on the browser matrix

Check the project's `browserslist`/`package.json`/target list before adopting any of these; if there is none, assume the last two versions of the evergreen browsers plus iOS Safari 16.4+.

| Feature | Use for | Fallback / trap |
|---|---|---|
| `oklch()` | Building an accent scale: equal L steps look equally spaced, unlike HSL | Perceptual ≠ accessible: still measure every text pair. Chroma above ~0.2 can fall outside sRGB and clip |
| `light-dark()` + `color-scheme` | Two-theme semantic tokens in one declaration | Needs `color-scheme: light dark` on `:root`; keep the existing theme mechanism if the project has one |
| Container queries (`container-type: inline-size`, `@container`) | A reusable component that sits in both a wide main column and a narrow sidebar | Page-level layout and global nav stay on viewport media queries |
| `:has()` | Styling a parent from child state (a card with a checked checkbox) without JS state | Don't use it for anything that must work in an unsupported browser |
| Cascade layers (`@layer`) | Only if the project already orders CSS with layers | Adding layers changes precedence of every existing rule |
| `content-visibility: auto` | Long, below-the-fold sections, after measuring | Breaks find-in-page anchors and some screen-reader traversal; give it `contain-intrinsic-size` |

## Focus ring default

```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: inherit; }
```

The ring must reach 3:1 against the surface it sits on, and `scroll-margin-top` on focusable targets keeps it clear of a sticky header.
