# Dashboard Motion Recipes

React + Motion (`motion/react`; the same API ships as `framer-motion` in older projects). Use the project's animation library if it already has one: the timings and order matter, not the library. Values come from `SKILL.md` §2–5.

## 1. Entrance: shell, card surfaces, content

```tsx
import { motion, useReducedMotion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1]; // ease-out, decelerating

export const grid = {
  hidden: {},
  show: { transition: { delayChildren: 0.15, staggerChildren: 0.05 } },
};

export const card = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.3, ease, when: 'beforeChildren', staggerChildren: 0.04 },
  },
};

export const content = {
  hidden: { opacity: 0, filter: 'blur(6px)' },
  show: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.25, ease } },
};

export function Rail({ children }) {
  return (
    <motion.nav
      initial={{ scaleY: 0.15, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease }}
      style={{ transformOrigin: 'center' }}
      className="rail"
    >
      {children}
    </motion.nav>
  );
}

export function DashboardGrid({ children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={grid} initial={reduce ? false : 'hidden'} animate="show" className="bento">
      {children}
    </motion.div>
  );
}

export function Card({ title, children, span }) {
  return (
    <motion.section variants={card} className={`card span-${span}`}>
      <motion.h3 variants={content}>{title}</motion.h3>
      <motion.div variants={content}>{children}</motion.div>
    </motion.section>
  );
}
```

`initial={false}` under reduced motion renders the final state with no entrance. Children inherit `hidden`/`show` through variants, so only the grid sets `initial`/`animate`.

**Word-by-word heading** (hero banners only):

```tsx
<motion.h1 variants={{ show: { transition: { staggerChildren: 0.035 } } }}>
  {text.split(' ').map((w, i) => (
    <motion.span key={i} variants={content} style={{ display: 'inline-block', marginRight: '0.25em' }}>{w}</motion.span>
  ))}
</motion.h1>
```

## 2. Count-up that doesn't replay

```tsx
import { animate, useInView } from 'motion/react';
import { useEffect, useRef } from 'react';

export function AnimatedNumber({ value, format = (n) => n.toLocaleString() }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null); // null = not shown yet → entrance from 0
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = prev.current ?? 0;
    const entrance = prev.current === null;
    prev.current = value;
    if (reduce) { ref.current.textContent = format(value); return; }
    const controls = animate(from, value, {
      duration: entrance ? 0.9 : 0.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => { if (ref.current) ref.current.textContent = format(n); },
    });
    return () => controls.stop();
  }, [value, inView]);

  return (
    <span aria-label={format(value)}>
      <span ref={ref} aria-hidden="true">{format(value)}</span>
    </span>
  );
}
```

The server renders the final value (no hydration jump); the entrance starts from 0 only on the first in-view mount; later values tween from the previous one.

**Smaller decimals:** split the formatted string at the decimal separator and render `<span class="cents">.16</span>` at ~0.6em and a lighter color. Keep `tabular-nums` on both parts.

## 3. Charts

**SVG bars growing from the baseline:**

```tsx
{data.map((d, i) => (
  <motion.rect
    key={d.label}
    x={x(d.label)} y={y(d.value)} width={bw} height={h - y(d.value)} rx={bw / 2}
    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
    transition={{ delay: 0.3 + i * 0.03, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    style={{ transformOrigin: 'bottom', transformBox: 'fill-box' }}
    fill={d.label === active ? 'var(--accent)' : 'url(#hatch)'}
  />
))}
```

`transform-box: fill-box` makes `transform-origin: bottom` refer to the bar itself, not the SVG.

**Hatched inactive bars:**

```svg
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="6" height="6" fill="var(--surface-2)" />
  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" stroke-width="2" />
</pattern>
```

CSS equivalent for div bars: `background: repeating-linear-gradient(45deg, var(--surface-2) 0 4px, var(--border) 4px 6px);`

**Line drawing in + area fading in after it:**

```tsx
<motion.path d={line} fill="none" stroke="var(--accent)" strokeWidth={2}
  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} />
<motion.path d={area} fill="url(#areaGradient)"
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }} />
```

**Gauge / progress ring:** a `circle` with `pathLength={1}` so the dash math is in fractions:

```tsx
<motion.circle cx={50} cy={50} r={42} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth={8}
  strokeLinecap="round" strokeDasharray="1 1"
  initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 1 - pct }}
  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ rotate: -90, transformOrigin: 'center' }} />
```

Half gauge: the same with `strokeDasharray="0.5 1"` and offset from `0.5` to `0.5 - pct / 2`, rotated 180°. Needle: `motion.g` rotating from `-90` to `-90 + 180 * pct`.

**Recharts:** keep its built-in animation and stagger by series/chart: `isAnimationActive`, `animationBegin={300 + index * 80}`, `animationDuration={700}`, `animationEasing="ease-out"`. Turn animation off for updates after the first render if the library replays the entrance on data change (`isAnimationActive={!hasAnimated}`), and let values morph instead.

## 4. Route change with a persistent shell

```tsx
// Shell (layout route) — mounted once
<nav className="pill-nav">
  {tabs.map((t) => (
    <Link key={t.href} href={t.href} className="tab" aria-current={t.href === path ? 'page' : undefined}>
      {t.href === path && (
        <motion.span layoutId="nav-pill" className="tab-pill"
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />
      )}
      <span className="tab-label">{t.label}</span>
    </Link>
  ))}
</nav>

// Content region only
<AnimatePresence mode="popLayout" initial={false}>
  <motion.main key={path}
    exit={{ opacity: 0, transition: { duration: 0.12 } }}>
    <DashboardGrid>{page}</DashboardGrid>
  </motion.main>
</AnimatePresence>
```

`.tab-pill` is absolutely positioned behind `.tab-label` (`z-index` below it). `mode="popLayout"` lets the new page start while the old one fades, so navigation never waits on the exit. For route stagger, pass `staggerChildren: 0.035` to the grid on non-initial mounts.

Rail variant: the same `layoutId` on the light circle behind the active icon.

## 5. Dark-mode circular reveal

```ts
export async function toggleTheme(button: HTMLElement, apply: () => void) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { apply(); return; }

  const { left, top, width, height } = button.getBoundingClientRect();
  const x = left + width / 2, y = top + height / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const t = document.startViewTransition(() => apply()); // apply() flips the class on <html>, synchronously (flushSync in React)
  await t.ready;
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
    { duration: 500, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
  );
}
```

```css
::view-transition-old(root),
::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
```

In React, wrap the state change in `flushSync` inside `apply` so the DOM is updated before the snapshot.

## 6. Workspace wipe

```ts
document.startViewTransition(() => switchWorkspace()).ready.then(() => {
  document.documentElement.animate(
    { clipPath: ['polygon(100% 0, 100% 0, 100% 100%, 100% 100%)', 'polygon(-30% 0, 100% 0, 100% 100%, 0 100%)'] },
    { duration: 500, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
  );
});
```

Same feature detection and reduced-motion fallback as §5.

## 7. Hover lift and chart dimming

```tsx
<motion.a whileHover={{ y: -4 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="card card--link" />
```

```css
.card--link { transition: box-shadow .18s ease-out; }
.card--link:hover { box-shadow: 0 8px 24px rgb(16 24 40 / .08); }
.chart:has(.bar:hover) .bar:not(:hover) { opacity: .4; transition: opacity .15s; }
```

## 8. Reduced motion, all in one place

- Grid: `initial={false}` (final state, no entrance).
- Numbers: final value immediately.
- Charts: `initial={false}` or library animation off.
- Route: a 120ms cross-fade only; the nav pill may jump.
- Theme/workspace: instant switch.
