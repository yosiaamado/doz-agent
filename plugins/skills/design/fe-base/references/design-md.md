# DESIGN.md — writing the design decisions down once

Read this when a product has **no design source yet** and you have just locked the five decisions (§1), or when the project already has a `DESIGN.md`/`design.md`/token file and you need to know how to read it. Idea adapted from kozz36/frontend-designer-skill (Apache-2.0) and practicalswan/agent-skills `frontend-design` (MIT); see `CREDITS-frontend-design.md`.

**Why it exists:** every later agent call otherwise re-derives the palette, scale and radii from scattered components — that is exploration turns, and drift. One file read beats twenty greps.

## Finding the source of truth

Look, in this order, and stop at the first hit: `DESIGN.md` / `design.md` at the repo root or `docs/` → a token file (`tokens.json`, `theme.ts`, `tailwind.config.*` `theme.extend`, `:root` custom properties in `globals.css`/`tokens.css`) → a component library's theme (shadcn `components.json` + CSS vars, MUI `createTheme`, Vuetify, Nuxt UI `app.config`). Whatever exists **wins** over `fe-base` defaults; `fe-base` only fills what it leaves open. Never rename or move it.

## Writing one (new product only)

Write it at the repo root when the brief sets the visual direction of a new product. Keep it under ~120 lines: tokens first, then the few rules a component author can't infer from the tokens.

```markdown
# Design — <product>

> This page is for <one sentence>. Mode: <product | marketing | dashboard | editorial | commerce>. Thesis: <one sentence: what it should feel like and why>.

## Tokens
| Group | Values |
|---|---|
| Space | 4 8 12 16 24 32 48 64 |
| Radius | 6 (controls) · 12 (cards) · 999 (pills) |
| Accent | --accent: oklch(0.55 0.16 255) — actions and indicators only |
| Neutrals | --bg #F7F8FA · --surface #FFFFFF · --border #E5E7EB · --text #0F172A · --muted #475569 |
| Semantic | --success · --warning · --danger (+ 10% tint for badges) |
| Type | Inter 400/600/700 · 12/14/16/18/24/32 · line-height 1.2 controls, 1.5 body, 1.7 long-form |
| Density | comfortable (rows 48px) |
| Surface | gapped |
| Motion | 150ms hover · 250ms panels · ease-out in, ease-in out |

## Rules
- The accent fills one hero surface per view; everything else neutral.
- <the 3–6 decisions specific to this product, e.g. "money is always Rp 1.250.000, right-aligned, tabular-nums">

## Contrast (measured)
| Pair | Ratio |
|---|---|
| --muted on --bg | 7.1:1 |
```

Fill the Contrast table with `scripts/contrast.py`, not by eye.

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
