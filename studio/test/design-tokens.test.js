import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = path.join(STUDIO, 'web/src/styles');
const read = (f) => fs.readFileSync(path.join(STYLES, f), 'utf8');

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function themeTokens(css, theme) {
  const header = theme === 'dark' ? /:root,\s*:root\[data-theme='dark'\]\s*\{([^}]*)\}/ : /:root\[data-theme='light'\]\s*\{([^}]*)\}/;
  const out = {};
  for (const m of (css.match(header)?.[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

test('design tokens: text contrast >= 4.5 in both themes', () => {
  const css = read('tokens.css');
  for (const theme of ['dark', 'light']) {
    const tk = themeTokens(css, theme);
    for (const fg of ['text', 'text-2', 'muted', 'primary-text', 'ok-text', 'run-text', 'fail-text', 'warn-text']) {
      for (const bg of ['bg', 'panel', 'panel-2']) {
        assert.ok(tk[fg] && tk[bg], `${theme}: --${fg} and --${bg} are defined`);
        assert.ok(contrast(tk[fg], tk[bg]) >= 4.5, `${theme}: --${fg} on --${bg} is ${contrast(tk[fg], tk[bg]).toFixed(2)}`);
      }
    }
    for (const fill of ['primary', 'primary-2']) {
      assert.ok(contrast(tk['on-primary'], tk[fill]) >= 4.5, `${theme}: --on-primary on --${fill}`);
    }
  }
});

test('design tokens: reduced motion is honored', () => {
  const base = read('base.css');
  const block = base.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const rule = block.match(/\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /animation-duration:\s*\.01ms/);
  assert.match(rule, /transition-duration:\s*\.01ms/);
});

test('design tokens: keyframes live in tokens/base/canvas only, all covered by the reduced-motion rule', () => {
  for (const f of fs.readdirSync(STYLES).filter((n) => n.endsWith('.css'))) {
    if (/@keyframes/.test(read(f))) assert.ok(['tokens.css', 'base.css', 'canvas.css'].includes(f), `${f} declares @keyframes`);
  }
});

test('design tokens: no new dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(STUDIO, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@anthropic-ai/sdk', 'fflate', 'ws', 'yaml', 'zod']);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
    '@vitejs/plugin-react', '@xyflow/react', 'electron', 'electron-builder', 'jsdom', 'lucide-react', 'react', 'react-dom', 'vite',
  ]);
});
