---
name: apple-design
description: Use when building or reviewing UI that should feel fluid and native — drag, swipe, sheets, drawers, carousels, springs and interruptible transitions, translucent or glass chrome, type tracking, platform conventions for web, desktop (Electron/Tauri) or mobile apps — or when asked for an Apple-style or HIG design review ("kerasa kayak app Apple", "review UI ini").
---

# Apple Design

`ui-design-taste` sets the visual system (spacing, palette, type scale, cards, states, basic motion timing). This skill adds what makes an interface feel **physical and native**: how things respond, move, layer and behave, plus a review method grounded in Apple's Human Interface Guidelines (HIG). Where both speak, `ui-design-taste` owns tokens and timing; this file owns interaction physics, materials and platform behavior.

The through-line: **motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.**

## 1. The eight principles — the first filter

Apple's HIG design principles (2026). A screen that breaks a principle has a bigger problem than any single rule it breaks.

| Principle | The question to ask |
|---|---|
| Purpose | What is this screen for? What did we decide *not* to build? |
| Agency | Can people explore, skip, choose their own path, and undo mistakes? |
| Responsibility | Are permissions, data use and AI behavior transparent and safe? |
| Familiarity | Do patterns match what people know, and do look-alikes behave alike? |
| Flexibility | Does it work across sizes, inputs, text sizes, languages and abilities? |
| Simplicity | Has every element earned its place? (Simple ≠ minimal: hiding everything isn't simple) |
| Craft | Is every spacing, timing and alignment a value you can defend? |
| Delight | Is there a deliberate feeling here? Delight is the result of the other seven, not decoration |

## 2. Response and direct manipulation

- **Feedback on pointer-down, commit on pointer-up.** Waiting for `click` to show a pressed state feels dead. Allow cancel by dragging away and back.
- **Kill every latency on the input path:** debounces, artificial timers, waiting for a transition to finish, the mobile tap delay.
- **Feedback is continuous during the gesture.** Drags, sliders and drawers follow the pointer 1:1 the whole way, never only animate at the end.
- **Respect the grab offset.** The element stays where it was grabbed; snapping its center to the pointer breaks the illusion. Use Pointer Events with `setPointerCapture`.
- **Keep a short position + time history** of recent `pointermove` events; you need velocity at release.
- **Hysteresis ~10px** before committing to a drag direction, and ~10px of forgiving hit padding around tap targets.
- **Recognize gestures in parallel** from the first move and cancel the losers once intent is clear. Avoid APIs that only report a final `swipe`, and only pay the double-tap delay where double-tap exists.

## 3. Springs and interruptibility

- **Every animation can be interrupted and redirected.** Never lock input during a transition. A closing sheet the user grabs follows the finger instead of finishing first.
- **Animate from the presentation value** (what's on screen now), never from the logical target, or it jumps.
- **Anything the user can touch, drag or throw uses a spring, not a CSS transition or `@keyframes`.** Fixed-duration curves from `ui-design-taste` §8 stay right for hover, fades and state changes nobody can grab.
- Think in **damping ratio** (overshoot: `1.0` = none) and **response** (seconds to reach the target — not a duration).

| Interaction | Damping | Response |
|---|---|---|
| Default UI, reposition | `1.0` | `0.3–0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

- **Bounce only when the gesture carried momentum** (a flick or throw). Overshoot on a menu that simply opened feels wrong.
- **On reversal, carry velocity through the re-target** instead of hard-cutting to a new animation (that's a velocity "brick wall"). Choose a spring library that does this.
- **Animate X and Y as independent springs** when velocities differ.

Velocity handoff, momentum projection and rubber-banding have exact formulas and code: read [references/motion-physics.md](references/motion-physics.md) **when implementing a drag, sheet, carousel or any thrown element.**

## 4. Spatial consistency

- **Enter and exit along the same path.** A panel in from the right leaves to the right.
- **Mirror the easing** on reversible transitions (inverse control points for the return).
- **Decide reverse vs commit by the velocity's sign** at release, not by position.
- **Intermediate frames point at the outcome**: an expanding module grows toward where it ends up, not a blind interpolation.
- **Keep per-frame movement small enough not to strobe**; very fast motion can stretch or blur slightly to encode speed.

## 5. Materials and depth

- **Translucency belongs to the floating functional layer only** — toolbars, tab bars, sheets, popovers — with content scrolling beneath. **Never in the content layer** (rows, cards, backgrounds).
- **Never stack a light translucent surface on another one**; legibility collapses. Nested glass needs one container.
- **Weight encodes hierarchy:** heavier, darker material separates structural regions; lighter material draws attention to controls. Bigger surfaces read thicker (more blur, deeper shadow).
- **Modal task → dim scrim and push the background back. Parallel, non-blocking panel → translucency and offset, no scrim.** Stacked sheets progressively dim each parent.
- **Text on translucent surfaces:** higher contrast, slightly heavier weight, a small tracking bump. Put color on a solid layer, not the glass.
- **Scroll edge effect instead of a divider:** fade a small blur or gradient mask only where floating chrome overlaps content.
- **Materialize, don't just fade:** animate blur radius and scale together on enter/exit.
- **Color budget on glass:** tint one or two primary actions per view at most.
- **Every material has fallbacks:** `prefers-reduced-transparency: reduce` → near-solid, no blur; `prefers-contrast: more` → solid background plus a defined border.

## 6. Typography details

The type scale is in `ui-design-taste` §3. Apple adds:

- **Tracking is size-specific:** negative on large display text (around `-0.02em`), near `0` for body, slightly positive for very small text. One `letter-spacing` for every size is wrong somewhere.
- **Leading runs inverse to size:** tight on large headings, looser on body; looser still for scripts with tall ascenders/descenders.
- **System font for navigation and controls** (`system-ui`): it ships optical sizing and tracking tables. Brand type lives in display text, content and moments. Use `font-optical-sizing: auto` on variable fonts.
- **Text follows the user's size setting** and layout scales with it (`rem`/`em` spacing). The layout must survive the largest size with hierarchy intact.
- **Apple's minimums:** mobile body 17pt default, 11pt minimum; desktop 13pt default, 10pt minimum. No light or thin weights at small sizes.

## 7. Accessibility beyond the basics

Contrast and color-only rules are in `ui-design-taste` §4. Add:

| Control size | Default | Minimum |
|---|---|---|
| Mobile (touch) | 44 × 44pt | 28 × 28pt |
| Desktop (pointer) | 28 × 28pt | 20 × 20pt |

Spacing between controls matters as much as their size.

- **Reduced motion means a gentler equivalent, not nothing:** springs, slides and parallax become short cross-fades. Keep color or opacity changes that aid understanding.
- **Vestibular safety:** no full-viewport moving backgrounds, no slow looping oscillation (around one cycle per 5s), no abrupt brightness jumps (ease light ↔ dark). Large objects go semi-transparent while travelling far.
- **Motion is never the only carrier of meaning.** Every icon-only control has a screen-reader label, and desktop works keyboard-only.

## 8. Feedback and interaction

- **Four kinds of feedback:** status, completion, warning, error. Validate inline as people type, not on submit.
- **Multimodal feedback:** it's obvious what caused it, visual + sound + haptic fire on the **same frame**, and it's reserved for meaningful moments (commit, snap, success, error).
- **Feedback lives in the interface, not in alerts.** Alerts are rare, never on launch, never for common undoable actions, and default to OK only when purely informational.
- **Destructive and irreversible → warning + Cancel. Everything else → undo.** Overused confirmations train people to click through.
- **A modal is one short task with an obvious way out.** Sheets: one at a time, a grabber when resizable, swipe to dismiss, and a way out besides Done.
- **Loading:** something appears immediately, people can keep working, progress is determinate when possible.
- **Data entry:** offer choices over typing, use the right keyboard/`inputmode`, never prefill a password.

## 9. Wayfinding, mapping and wording

- Every screen answers: **where am I, where can I go, what's here, how do I get out.** Never trap the user.
- **Place a control near what it affects and arrange it to mirror what it changes.** If a control needs a label to explain it, the mapping is weak.
- **Specific labels beat safe ones:** "Library", "Progress" over "Home"; "Save changes" over "Submit".
- **An action keeps its name through the flow:** a "Publish" button produces "Published".
- **One capitalization convention per platform, applied everywhere** (Apple: title-style for buttons, menus, titles; Material and most web: sentence case).
- **Errors say what went wrong and how to fix it,** in the product's voice, without apologizing. Names come from what people control, not how the system is built.

## 10. Platform conventions

When the product is a desktop app (Electron, Tauri), a mobile app (React Native, Flutter) or a web app that should feel native, apply the conventions in [references/platform.md](references/platform.md) — vocabulary, navigation, menus, sheets, windows, Apple Pay on the web, glass in code. **Read it when building navigation, app chrome, desktop menus or a checkout.** Plain web pages get the principles and foundations above, not Apple's platform rules.

## 11. Craft lens

On top of `ui-design-taste` §9–10:

- **Name the one thing this design will be remembered by.** If nothing, say so. A deliberately quiet utility is a valid answer — say that too.
- **Spot generated defaults:** warm cream + high-contrast serif + terracotta accent; near-black + one acid-green or vermilion accent; a broadsheet of hairline rules, zero radius and dense columns; a hero of a big number over a small label with a gradient; `01 / 02 / 03` markers on content that isn't a sequence. A look with no reason rooted in the product is a default, not a choice.
- **Structure must say something true:** numbering, eyebrows, dividers and labels encode real information.
- **Familiar components carry navigation and controls; identity lives in color, type, imagery, voice and a few defining moments.** A restyled control keeps familiar size, placement and behavior.
- **Remove one accessory.** If nothing can go without loss, say the design is already lean.

## 12. Reviews and redesigns

When asked for a design review (screenshot, mockup or UI code) or to improve or "make it less generic", read [references/review.md](references/review.md) **before writing the review**: the five lenses in order, severity tags, the report format, and the plan-then-critique improvement method.

## Sources

Distilled and rewritten (no text copied) from [emilkowalski/skills — apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design) (MIT, see `references/LICENSE-emilkowalski.md`), its mirror on [ui-skills.com](https://www.ui-skills.com/skills/emilkowalski/apple-design), and the reviewer method in [dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill). Apple's guideline text is not reproduced; the primary source is the [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) and Apple's WWDC design talks (*Designing Fluid Interfaces*, *The Details of UI Typography*, *Designing Audio-Haptic Experiences*).
