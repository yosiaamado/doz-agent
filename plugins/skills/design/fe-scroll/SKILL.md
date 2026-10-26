---
name: fe-scroll
description: Use when building a landing or marketing page meant to feel like an experience — scrollytelling, scroll-driven sections, a layered or cinematic hero, a page where scrolling plays a video, a 3D scroll world, an Apple-style product page — or when a landing page "looks like a template". Don't use for app screens or dashboards (fe-base, fe-dashboard).
---

# FE Scroll — scroll craft

Scroll is the one input every visitor already knows. This skill treats it as a timeline: the wheel scrubs, the page is a film with real text on top, and each section behaves differently enough that the visitor keeps going to see what the next one does.

**You produce:** `BRIEF.md` (brief, journey, feeling curve, peak), a page grammar, a scroll score (device per beat), one bespoke signature move, the assets, one real HTML page on the bundled engine, and screenshots proving it holds at every scroll position.

`fe-base` still governs type, color, spacing and contrast inside the page; `references/taste.md` is this skill's stricter version for scroll pages. Adapted from [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) (MIT, `references/LICENSE-scroll-craft.md`). `<skill>` below means this skill's folder.

## The spine

1. **Variety is the product.** At least four device families per page, never the same device twice in a row. Five sections that behave identically are one section shown five times. → [references/devices.md](references/devices.md)
2. **Photographic world unless the brand is genuinely illustrated.** Soft matte clay/low-poly diorama is banned as a default. → [references/worlds.md](references/worlds.md)
3. **No continuous camera chain** unless the brief literally says "one continuous journey". Varying the device hides the cut for free.
4. **A different world is not a different page.** Structure (grammar, nav, hero, act shape, close) is a separate axis and must be decided, or every build inherits the last one's skeleton. → [references/uniqueness.md](references/uniqueness.md)

**Premium hero = dimensional layering.** Plan independently moving background, subject, foreground and atmosphere planes before requesting any asset; one background image with text fades does not qualify. Depth comes from separation, occlusion and controlled differences in movement, while the headline stays readable. Read [references/hero-depth.md](references/hero-depth.md) before planning the hero. Honor an explicit "keep it static/simple", and keep depth in the static composition when motion is reduced.

Before planning any premium marketing site, read [references/approved-collection.md](references/approved-collection.md): execution principles from ten approved builds — not a skeleton to copy.

## Step 0 — Brief and creative authority

Reuse answers and assets already given. Then:

- **Creative direction explicitly delegated** ("terserah kamu", "use your judgment") → write a brief headed `Self-authored under explicit creative delegation`, mark evidence vs assumptions, and proceed. No invented user quotes, no extra approval round.
- **Otherwise ask once, all eight in one pass:**
  1. Vibe in 3–5 words + up to three references from any medium (a film, an album, a shop — not "sites you like").
  2. The scroll journey, section by section, in their words.
  3. The energy curve: where calm, where intense.
  4. How should someone feel at each stage, and the ONE moment they should remember. → [references/feel.md](references/feel.md)
  5. One thing this site does that no site they've seen does (seed of the signature move; push past "be memorable").
  6. How far from premium-minimal: brutalist, maximalist, playful, retro, dense, editorial, minimal ([uniqueness.md §5](references/uniqueness.md)).
  7. One unbroken world ([references/worldflight.md](references/worldflight.md)) or distinct scenes? Their call, neither is the default.
  8. Assets they already have: footage, photos, product shots, brand kit. "Nothing" means a fully generated world.
- **Running as a subagent that cannot ask** and nothing was delegated → return `Status: needs-decision` with the eight questions, unless the brief says to proceed; then self-author and head the file `Self-authored, not interviewed`.

Write `<workspace>/builds/<name>/BRIEF.md` before planning acts, in their words. It must contain: the eight answers; **the feeling curve** (one line per act: emotion, then what on screen causes it); **the peak** (the sentence a visitor would tell a friend, plus its act); **"It's the site where ___"** filled with an experience, not a device name; any authored silence, so verification can tell it from dead scroll.

## Bootstrap (once, after the brief)

```bash
node <skill>/scripts/doctor.mjs              # node, full ffmpeg, playwright + Chrome, API key, workspace
node <skill>/scripts/workspace.mjs --ensure  # resolves, creates and seeds the workspace
```

- Workspace resolution, first hit wins: `SCROLLCRAFT_HOME` → nearest `.scrollcraft.json` `{ "workspace": "..." }` → `<git root>/scrollcraft`. Builds go in `<workspace>/builds/<name>/`, the registry is `<workspace>/FINGERPRINTS.md` (starts empty).
- A stripped ffmpeg reports a missing filter as a syntax error in your command — trust doctor, not the error text. Report missing items plainly; don't work around them silently.
- **Generating assets is optional and costs money.** It needs `KIE_AI_API_KEY`, spends credits, and uploads reference images to kie.ai's servers. Ask the user before the first `kie.mjs` call; a build from their own photos and footage is a first-class route, not a fallback.
- Read the brand kit if one exists and obey its hard rules (a brand that forbids invented numbers means no stat counters).
- Copy `engine/scrollcraft.js` and `engine/scrollcraft.css` into the build. **Never edit the engine per project**: theme it with tokens and write your own markup.
- On Windows, run the `.sh` scripts through Git Bash.

## Step 1 — Journey first

Ask only what you can't default: what it is and who it's for; the one sentence the visitor must believe by the end (make them pick one); the one next action and its single label, used everywhere; art direction from [references/worlds.md](references/worlds.md) as a real choice. Never offer a made-up menu of industries.

Then write the **journey**: 4–7 beats, each a shift in what the visitor knows or feels (e.g. Recognition → Tension → Turn → Substance → Range → Commitment). Sections serve beats; a section that serves none is cut, however nice the shot. Resolve the journey before any asset exists; show it when their decision is needed.

## Step 2 — Grammar, gate, curve, score

Full method in [references/uniqueness.md](references/uniqueness.md). In this order:

1. **Pick a grammar** from the eight defined ones. A new grammar counts only if its navigation, sequence, ending and bans differ — a new label earns nothing. Filmic one-shot was the default of the first builds, so choosing it means saying why the other seven lost. Nav, hero and close follow from the grammar.
2. **Invent the signature move**: one bespoke interaction coded in the page, not a retuned kit device. Question 5 is the seed.
3. **Fingerprint gate**: the plan must differ from **every** row of `FINGERPRINTS.md` on at least 4 of 6 dimensions — grammar, nav treatment, hero device, act-sequence shape, close pattern, signature move. Fails → change the plan, never the log.
4. **Feeling curve before the score.** One line per act. Two adjacent acts with the same feeling → one is filler; cut it now. Name the peak and give it the largest span.
5. **Score table**: `| Beat | Device | Why this one |`, read against your grammar's leans-on and bans list.

Checks before building:

- The grammar's bans hold (a grammar that forbids `pin` forbids it here).
- ≥ 4 distinct device families; none twice in a row; at most two `scrub` acts.
- One peak with visibly the largest span; the act before it is quieter.
- Every act earns its scroll span. 8–14 viewport-heights is a reference for long cinematic pages, not a quota; editorial or working-surface grammars stay short. No filler pinning.
- Not 6–7 acts at 13.6–13.8vh total: every early build landed there, and it is now a fingerprint.

## Step 3 — Assets

Read [references/assets.md](references/assets.md) for the pipeline, prompt scaffolds and costs. What decides premium vs generated:

- **One style preamble, reused verbatim in every prompt** — that's what makes six images look like one shoot.
- **Read every PNG before using it.** Rerolling is cheaper than shipping a bad frame.
- **Encode for scrubbing, not playback**: `bash <skill>/scripts/encode.sh in.mp4 assets/01.mp4` (add `mobile` for the portrait cut). It sets a dense GOP and strips audio; a normal web encode scrubs like mud.
- **Layer the hero** into planes that move at slightly different rates, product parked between mid and foreground (`parallax` in devices.md).

## Step 4 — Build the page

Real HTML: real `<h1>`, `<p>`, links and reading order. The engine reads `data-sc-*` attributes off your markup and never generates DOM. Start from `references/template.html`; device patterns in devices.md; **read [references/taste.md](references/taste.md) before writing markup**, and build without announcing the checklist.

Theme with six tokens and two fonts:

```css
:root {
  --sc-canvas: #0A0806;  --sc-surface: #16110E;
  --sc-ink:    #F5EBDD;  --sc-ink-soft: #A2968A;
  --sc-accent: #FF5A3D;  --sc-accent-ink: #15110F;
  --sc-font-display: "Archivo", system-ui, sans-serif;
  --sc-font-text:    "Geist", system-ui, sans-serif;
}
```

Bespoke behavior lives in page JS driven off `--sc-p` and your own `data-sc-*` attributes.

## Step 5 — Verify by scrolling it

A scroll page has no single state; the failures live between the two positions you happened to look at. Full procedure in [references/verify.md](references/verify.md); final-package checks in [approved-collection.md §7](references/approved-collection.md#7-require-visual-and-functional-evidence-before-delivery).

```bash
cd <build> && npm i playwright-core   # once
node <skill>/scripts/serve.mjs --root . --port 4500 &
node <skill>/scripts/shoot.mjs --url http://localhost:4500 --out lab/shots
node <skill>/scripts/shoot.mjs --url http://localhost:4500 --out lab/mobile --width 390 --height 844
node <skill>/scripts/shoot.mjs --url http://localhost:4500 --out lab/reduced --reduced-motion
```

The harness walks each act at six positions, waits for scrub video to settle, and reports dead scroll, cues that never reach full opacity, and contrast measured on the composited page at the brightest frame under each line. Then:

1. **Read `sheet.png` yourself.** The harness proves a clip advances, not that the composition is good. Tab through for focus order. Use headless automation with native pointer lock/capture disabled.
2. **Feel check** ([feel.md §6](references/feel.md)): scroll cold, write one word per act, *then* diff against BRIEF.md. Where they disagree, the page is wrong. Confirm the peak is the largest visual change with the most scroll room, and the last screen resolves instead of fading out.
3. **Say what green doesn't cover: a real phone.** Headless Chrome can't reproduce the iOS video decoder, autoplay policy, Low Power Mode or touch scroll. On the first reported mobile defect, deploy `references/device-diag.html` beside the site and let the device answer. `serve.mjs --lan` exposes everything under `--root` to the network — stop it when done.

Fix, shoot again, and report what you verified and what you didn't.

## Hard rules

| Never | Instead |
|---|---|
| Clay/low-poly diorama as the default world | Photographic (worlds.md) |
| "Scroll" cue, arrow or animated mouse icon | Nothing; they're already looking at the hero |
| `01 / 06` section counters | Delete them |
| An eyebrow above every heading | At most one per three sections |
| Em dash in visible copy | Period, comma, colon or parentheses |
| Centred copy in every act | Vary the anchor: lead, trail, centre, split |
| The same device twice in a row | Re-score the journey (Step 2) |
| Generating before the brief and authority are clear | Step 0, written to BRIEF.md |
| No engineered peak, or three competing ones | One peak: the asset budget, the silence before it, the most scroll room |
| An ending that fades out or just becomes a footer | The close resolves and holds |
| Acts planned before the feeling curve | Curve first, devices second |
| No bespoke signature move | Invent one; a recoloured spotlight is not one |
| Clearing < 4 of 6 fingerprint dimensions against any row | Change the plan, not `FINGERPRINTS.md` |
| Editing the engine for a bespoke behavior | Page JS off `--sc-p` and your own `data-sc-*` |
| A full-frame dark overlay to fix contrast | A scrim only where the text sits |
| Text baked into a generated image | Real markup |
| Invented statistics in a counter | Real numbers only; no number, no counter |
| `transition: all`, animating width/height/top/left | `transform`, `opacity`, `clip-path` for wipes |
| Gradient text, neon glow, zero-offset coloured halos | Weight and size for emphasis; offset+blur shadows |
| Any audio on a scrub clip | Stripped (`encode.sh` does it) |
| Shipping without Step 5 | Run Step 5 |

## Output

The build folder including `BRIEF.md`, then a short report: grammar and why the other seven lost; the signature move; the fingerprint result against each row; the journey; the feeling curve and peak; the feel-check diff and what you changed; the score table; what was generated (and spent); what was verified with screenshots and what wasn't; whether the brief was self-authored; the local URL. Then append the build's row to `<workspace>/FINGERPRINTS.md`.
