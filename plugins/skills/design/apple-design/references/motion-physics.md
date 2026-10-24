# Motion Physics for the Web

Read this when implementing a drag, a bottom sheet, a drawer, a carousel, a swipe-to-dismiss, or anything a user can throw. The rules are in `SKILL.md` §2–4; this file has the math and code.

The projection and rubber-band formulas follow Apple's *Designing Fluid Interfaces* (WWDC 2018) sample code as translated for the web by Emil Kowalski (MIT, see `LICENSE-emilkowalski.md`). Code below is rewritten for this repo.

## 1. Press feedback

```css
.pressable { transition: transform 100ms ease-out; }
.pressable:active { transform: scale(0.97); }
```

The pressed state shows on pointer-down. The action itself still commits on pointer-up.

## 2. Tracking a drag with velocity

```ts
type Sample = { y: number; t: number };

function trackDrag(el: HTMLElement, onMove: (y: number) => void, onRelease: (y: number, velocity: number) => void) {
  let grabOffset = 0;
  let samples: Sample[] = [];

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);            // keep tracking outside the element
    grabOffset = e.clientY - el.getBoundingClientRect().top; // stay where it was grabbed
    samples = [{ y: e.clientY, t: e.timeStamp }];
  });

  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    samples.push({ y: e.clientY, t: e.timeStamp });
    samples = samples.filter((s) => e.timeStamp - s.t < 100); // last ~100ms only
    onMove(e.clientY - grabOffset);
  });

  el.addEventListener('pointerup', (e) => {
    const first = samples[0];
    const dt = (e.timeStamp - first.t) / 1000;
    const velocity = dt > 0 ? (e.clientY - first.y) / dt : 0; // px/s
    onRelease(e.clientY - grabOffset, velocity);
  });
}
```

## 3. Springs with Motion / Framer Motion

The `bounce` + `duration` spring API maps closely to Apple's damping ratio + response.

```ts
import { animate } from 'motion';

// Default: critically damped, no overshoot
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });

// After a flick only: a little bounce, carrying the release velocity
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4, velocity: releaseVelocity });
```

Re-targeting a running Motion spring starts from the current value and velocity, which is what interruption needs. Libraries already built on these rules: Vaul (sheets), Embla (carousels).

## 4. Velocity handoff

The animation after release continues at the pointer's exact velocity, so there is no seam between dragging and animating.

- Motion / Framer Motion take absolute velocity in px/s (`velocity` above).
- APIs that want **relative** velocity:

```
relativeVelocity = gestureVelocity / (targetValue − currentValue)
```

Example: at `y = 50`, target `y = 150` (100px to go), finger at 50 px/s → `0.5`.

## 5. Momentum projection

Pick the snap target from where the gesture **is going**, not from where it was released.

```ts
// decelerationRate ≈ 0.998 for a normal scroll feel, 0.99 for snappier
function project(velocity: number /* px/s */, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

const projected = currentY + project(releaseVelocity);
const target = nearestSnapPoint(projected);
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4, velocity: releaseVelocity });
```

This exponential-decay form is what scroll deceleration uses. The textbook `v² / (2·a)` gives a different, wrong-feeling landing point.

## 6. Rubber-banding at edges

Past a boundary, resistance grows the further the user pulls, instead of a hard stop.

```ts
// overshoot: px past the edge; dimension: size of the scroll/drag area
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

On release past the edge, spring back to the boundary with damping `1.0`.

## 7. Translucent chrome and its fallbacks

```css
.toolbar {
  background: rgb(255 255 255 / 0.6);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgb(255 255 255 / 0.4); /* a bright edge reads as light on the material */
}

@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: rgb(255 255 255); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .toolbar { background: rgb(255 255 255); border-top: 1px solid rgb(0 0 0 / 0.6); }
}
```

`backdrop-filter` over animating content is expensive: keep glass regions few and small. Support for `prefers-reduced-transparency` differs by engine (see `platform.md` §4).

## 8. Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
```

In JS, check `matchMedia('(prefers-reduced-motion: reduce)').matches` before starting a spring, and cross-fade instead.

## 9. Reviewing motion

Play it slowed down or frame by frame. Look for: a jump at the start (animating from the target, not the presentation value), a seam at release (velocity not handed off), a stop-start at reversal (velocity hard-cut), and overshoot where no momentum preceded it.
