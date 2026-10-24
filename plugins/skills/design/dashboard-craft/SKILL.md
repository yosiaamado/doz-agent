---
name: dashboard-craft
description: Use when building or polishing a dashboard, admin panel or analytics screen — KPI cards, charts, sidebar or top-nav shell, page/route transitions, dark-mode toggle, entrance or count-up animations — or when the user wants it to feel premium, alive or "kayak di Dribbble" ("animasinya kurang", "dashboard-nya kaku").
---

# Dashboard Craft

`ui-design-taste` owns the tokens (spacing, radii, palette, type scale) and the anatomy of a single KPI card, chart and table. `apple-design` owns anything the user can grab. This file owns the two things that make a dashboard feel premium rather than templated: **how the screen is composed** and **how it moves** — first load, route change, theme switch, live data.

The through-line: **the shell never moves, content arrives in reading order, every number and chart has an entrance exactly once, and nothing blocks input.**

## 1. Composition

### The shell is persistent

Pick one shell per product and keep it mounted across routes. It never replays an entrance after the first load.

| Shell | Use when | Shape that reads premium |
|---|---|---|
| **Floating rail** | 6–10 sections, icon-recognisable | A dark capsule (~56px wide, full radius) inset 12–16px from the viewport edge, icons only, logo on top, logout at the bottom. Active item = light circle behind the icon + a 4px notch on the rail edge. Label as a dark tooltip pill on hover/focus |
| **Top pill nav** | ≤6 sections, wide content | A white pill container in the header holding text tabs; active tab = filled pill (near-black or accent) that **slides** between tabs. Logo left, utility icons + avatar right, each in its own round button |

### The canvas

- **Light grey canvas, white cards, no borders between them** — separation comes from the canvas showing through 12–16px gaps. Cards 16–24px radius on this layout (still one card radius per product).
- **A bento grid, not equal tiles.** 12 columns; cards span 3/4/5/6/8 so rows have rhythm. A tall card next to two stacked short ones reads designed; four identical KPI tiles read generated.
- **One hero surface per view, filled with the accent** — a revenue card, a "Manage quotes" call-to-action, a welcome banner. Everything else neutral. A second filled card halves the effect of both.
- **Page header carries weight:** a 28–40px title (or a headline-sized search field) on the left, period/filter pills and one primary action on the right. A KPI trio can sit inline in the header row instead of in cards.
- **Dark floating surfaces on a light page** for things that sit above content: a "next meeting" popover, chart tooltips, a bottom-centre switcher pill. One dark element per region at most.
- **Real-feeling content:** avatars with names, specific labels ("Q4 revenue", "Breakthrough brainstorm 12:45"), not "Item 1". Dummy data that looks real is part of the design.

### Numbers

- Big figure with **cents/decimals one step smaller and lighter** (`$4,857` `.16`), `tabular-nums`, delta pill right beside it, comparison text under it.
- Abbreviate in tiles (`$49.6K`), full precision in tooltips and tables.

### Charts that read premium

Use these instead of default library styling. Each one has a single focal point.

| Pattern | Build |
|---|---|
| **Spotlight bar** | All bars neutral (light grey, or a diagonal hatch for "inactive/forecast"), one bar — current or hovered period — in the accent with a value pill above it |
| **Spline area** | Smooth curve, 2px stroke, gradient fill from accent at ~25% opacity to 0, vertical crosshair + dark tooltip pill at the hovered point, no gridlines except 3–4 faint horizontals |
| **Gauge** | Half-donut track in neutral, accent arc for the value, an optional needle; the number sits inside or beside it, not on the arc |
| **Progress ring** | Per goal or per category in a row of small cards; percent centred, label under |
| **Heat calendar** | Circles or rounded squares in 3–4 tints of the accent; today ringed |
| **Line over density** | Thin line(s) over a field of very thin vertical bars (activity per hour/day) for texture |

Legends sit inline above the chart as dot + label. Period switcher (`Weekly | Monthly`) is a small segmented pill in the card header.

## 2. First-load choreography

The entrance is a sequence, not every element fading at once. Total budget **≤ 1.2s** from shell to last chart; the page is interactive from frame one.

| Step | Starts | What moves | Motion |
|---|---|---|---|
| 1. Shell | 0ms | Rail grows from a short capsule to full height (`scaleY`, origin centre) or the top nav fades in | 250–350ms ease-out |
| 2. Card surfaces | ~150ms | Empty card shells appear in **reading order** (hero / top-left first), 40–60ms apart | opacity 0→1, `y` 8–12px→0, `scale` .98→1, 300ms ease-out |
| 3. Card content | each card +100–150ms after its surface | Titles and copy | opacity + `filter: blur(6px)`→0, 250ms. Long headings may reveal word by word, 30–40ms apart |
| 4. Numbers | with content | Count up from 0 to the value | 700–1000ms, ease-out (decelerate into the final value) |
| 5. Charts | with content | Bars grow from the baseline (`scaleY`, origin bottom, 30ms stagger); lines draw (`pathLength` 0→1); gauges and rings sweep their arc; needles rotate from the minimum | 600–900ms ease-out |
| 6. Small extras | last | Avatars pop in staggered, status dots, badges | 150–200ms |

Rules that make this work:

- **Stagger groups, not elements.** Animate ~6–12 cards; children ride with their card. Fifty independently staggered elements read as lag.
- **Skeleton = the card surface itself.** Steps 2→3 *are* the loading state when data is fetched: the surface appears, content fills in when ready. Don't show a spinner and then also run the entrance.
- **Entrance plays once per mount**, never on refetch, filter change or polling (see §5).

The variants, count-up hook and chart draw code are in [references/recipes.md](references/recipes.md) §1–3 — **read it when writing the entrance code.**

## 3. Route change

- **Shell stays; only the content region transitions.** Re-animating the sidebar on every click is the most common tell of a demo.
- **Active indicator travels:** the nav pill or the rail's highlight moves to the new item with a shared-layout animation (spring, no bounce, ~0.35s). This is the one element that carries continuity.
- **Old content leaves fast and flat:** opacity → 0 in 120–150ms, no movement. Waiting for a long exit makes navigation feel slow.
- **New content replays §2 steps 2–5, compressed:** 30–40ms stagger, total ≤ 700ms.
- **Tables:** stagger only the first ~10 rows (20–30ms); the rest appear with the last of them.
- Back/forward navigation and restored tabs may skip the entrance entirely.

Code: [references/recipes.md](references/recipes.md) §4.

## 4. Theme and workspace switches

- **Dark-mode toggle = circular reveal from the toggle button.** The new theme grows as a circle centred on the button until it covers the viewport, 450–600ms ease-in-out. Use the View Transitions API; where unsupported or under reduced motion, switch instantly. Code: [references/recipes.md](references/recipes.md) §5.
- The dark theme is designed, not inverted (`ui-design-taste` §4): surfaces raised by lightness, the hero card keeps its accent, chart gradients re-tuned for dark.
- **Switching between whole products/workspaces** (e.g. a bottom switcher pill between two apps) may use a diagonal wipe (`clip-path` polygon sweeping across, ~500ms). Reserve it for that: a wipe on ordinary navigation is noise.

## 5. Interaction and live data

- **Hover lift only on clickable cards:** `y: -4px` + slightly deeper shadow, 150–200ms. A lift on a non-clickable card promises an action that doesn't exist.
- **Chart hover:** the hovered bar/point takes the accent, the rest dim to ~40%; tooltip snaps to the data point, not the cursor.
- **Live or refetched numbers tween from the previous value** to the new one (300–500ms), never from 0. Optionally tint the delta green/red for ~1s.
- **Filter/period change:** charts morph from the old data to the new (bars change height, line interpolates), no re-entrance, no flash of empty.
- **Tooltips on the rail:** appear after ~300ms hover, instantly on keyboard focus, and hide on leave without delay.

## 6. Traps

| What seems fine | What actually happens |
|---|---|
| Count-up in a `useEffect` on `value` | Replays from 0 on every refetch/poll. Animate from the previous value; play the from-0 entrance only on mount |
| Animating bar `height` or SVG `height` attrs | Layout work every frame and janky on large charts. Use `transform: scaleY()` with `transform-origin: bottom` (or the chart library's own animation props) |
| `filter: blur()` on every element | Expensive on big surfaces and low-end laptops. Blur-in headings and short text only |
| Staggering every row of a 200-row table | The last row appears seconds later. Cap the stagger (§3) |
| Entrance wrapped around the whole route with `AnimatePresence mode="wait"` and a long exit | Every click waits for the exit. Keep exits ≤150ms |
| Count-up text read by screen readers | Announces dozens of intermediate values. Put the final value in `aria-label` and hide the animated digits with `aria-hidden` |
| SSR / hydration with animated numbers | Server renders `0`, client jumps. Render the final value on the server and animate only after hydration, or start the entrance from the client-only mount |
| Theme reveal without the API check | Breaks or flashes in browsers without View Transitions. Feature-detect and fall back to an instant switch |
| `prefers-reduced-motion` handled by "disable animations" CSS only | JS-driven count-ups and springs still run. Check the media query in JS too: show final values, cross-fade instead of slide |

## 7. 3D / scene dashboards

Only when the product has a real spatial metaphor (a floor, a warehouse, a fleet, an office of agents). Otherwise it is decoration that costs bundle size and battery.

- The scene (e.g. React Three Fiber) is the **content layer**; KPIs, greetings and actions stay as DOM cards floating over it.
- Labels pinned to objects ("Jake $54.5k") are DOM overlays positioned from the 3D coordinates, so they stay crisp and accessible.
- Floating HUD cards follow `apple-design` §5 (translucency only on floating chrome, fallbacks).
- A side panel (an assistant chat, a detail drawer) slides over the scene from the edge and leaves along the same path.
- Lazy-load the scene, show a static render first, and give a plain list/table view of the same data.

## 8. Checklist before handing over

- [ ] Shell mounts once; route changes animate only the content region and the active indicator.
- [ ] One accent-filled hero surface per view; the rest neutral.
- [ ] First load ≤ 1.2s, in reading order, groups staggered (not every element).
- [ ] Every chart has one focal point (spotlight bar, hovered point, needle) and an entrance that plays once.
- [ ] Refetch, filter and polling update values by tweening from the old value — no re-entrance, no flash of empty.
- [ ] Only `transform`, `opacity` and (sparingly) `filter`/`clip-path` animate.
- [ ] Reduced motion: final values and states immediately, cross-fades instead of slides, no circular reveal.
- [ ] Animated numbers have their final value in `aria-label`.
- [ ] Dark theme designed and switched with the reveal (or instantly as the fallback).

## Sources

Observed on 2026-10-25 from the public dashboard reels of [@code.xr](https://www.instagram.com/code.xr/) (Dashboard V14, V15, V16, V18, 3D Dashboard + AI) by stepping through video frames. The source code isn't public, so the timings and values here are the team's decisions fitted to what the frames show, not measurements. What each dashboard showed is in [references/source-dashboards.md](references/source-dashboards.md) — read it when choosing a visual direction for a new dashboard.
