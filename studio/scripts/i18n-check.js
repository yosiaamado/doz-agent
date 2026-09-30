// i18n check (AC-6): en/id key parity, used vs. defined keys, and leftover hardcoded strings in the UI.
// Usage: `npm run i18n:check`. Exits 1 on any blocking finding; unused keys are warnings only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..');

const KEY_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const T_CALL_RE = /\bt\(\s*['"]([a-z0-9.-]+)['"]/g;
const QUOTED_RE = /(['"`])((?:\\.|(?!\1).)*)\1/g;
const HAS_WORD = /[A-Za-z]{2,}/;
// Indonesian words that could never show up in an English UI string.
const INDONESIAN = /\b(yang|tidak|belum|dengan|untuk|dari|sudah|atau|kalau|pilih|simpan|batal|hapus|gagal|berhasil|memuat|jalankan|tersimpan|perubahan|sukses|berjalan|menunggu|karakter|selesai|permintaan|catatan|tampilkan|kecilkan)\b/i;
const UI_ATTRS = 'title|aria-label|placeholder|label|alt|ariaLabel|subtitle|hint|description|confirmLabel|createLabel';
const ATTR_RE = new RegExp(`\\b(?:${UI_ATTRS})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'g');
const PROP_RE = new RegExp(`\\b(?:title|message|label|confirmLabel|cancelLabel|placeholder|description|hint|subtitle|ariaLabel)\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g');
const CALL_RE = [
  /\bnotify\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g,
  /\bopt\(\s*(?:'[^']*'|"[^"]*"|[\w.?]+)\s*,\s*(['"`])((?:\\.|(?!\1).)*)\1/g,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const isKeyLiteral = (s) => KEY_RE.test(s);
// An i18n key, a lowercase technical word ('claude-cli', 'opus'), or a symbol: not UI copy.
const looksLikeCopy = (raw) => {
  const s = raw.replace(/\$\{[^}]*\}/g, '');
  return HAS_WORD.test(s) && !isKeyLiteral(s) && (/\s/.test(s.trim()) || /^[A-Z][a-z]/.test(s.trim()));
};

// Replace block comments with blank lines (keeping line numbers) and drop trailing `//` comments.
function codeLines(source) {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock.split('\n').map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

// Strip {...} expressions (up to 4 levels deep) so only text and JSX tags remain.
function stripBraces(line) {
  let out = line;
  for (let i = 0; i < 4; i++) out = out.replace(/\{[^{}]*\}/g, '');
  return out;
}

export function scanHardcoded(file, source) {
  const raw = source.split('\n');
  const code = codeLines(source);
  const found = [];
  const ignored = (i) => /i18n-ignore/.test(raw[i]) || (i > 0 && /i18n-ignore/.test(raw[i - 1]));
  const add = (i, why, snippet) => { if (!ignored(i)) found.push({ file, line: i + 1, why, snippet: snippet.trim().slice(0, 80) }); };
  let prev = '';
  code.forEach((line, i) => {
    // A string containing < or > (e.g. '<role>') is not JSX markup.
    const stripped = stripBraces(line.replace(/(['"`])(?:\\.|(?!\1).)*[<>](?:\\.|(?!\1).)*\1/g, '""'));
    const tagText = [...stripped.matchAll(/<[A-Za-z][^<>]*?(?<![=-])>([^<>]*)</g)].map((m) => m[1]);
    const tail = /<[A-Za-z][^<>]*?(?<![=-])>([^<>]+)$/.exec(stripped);
    if (tail) tagText.push(tail[1]);
    for (const text of tagText) if (HAS_WORD.test(text)) add(i, 'JSX text', text);
    const bare = stripped.trim();
    if (bare && /(?<![=-])>$/.test(prev.trim()) && !/[<>{}=;()]/.test(bare) && !/^(\/\/|\*|\/\*|import|export|return)/.test(bare) && HAS_WORD.test(bare)) add(i, 'JSX text', bare);
    for (const m of line.matchAll(ATTR_RE)) {
      const value = m[1] ?? m[2];
      if (HAS_WORD.test(value)) add(i, 'attribute', m[0]);
    }
    for (const m of line.matchAll(PROP_RE)) if (looksLikeCopy(m[2])) add(i, 'property', m[0]);
    for (const re of CALL_RE) for (const m of line.matchAll(re)) if (looksLikeCopy(m[2])) add(i, 'call', m[0]);
    for (const m of line.matchAll(QUOTED_RE)) {
      if (INDONESIAN.test(m[2])) add(i, 'Indonesian word', m[0]);
      if (/^id-ID$/.test(m[2])) add(i, 'hardcoded locale', m[0]);
    }
    if (bare) prev = line;
  });
  return found;
}

// Run every check. `en`/`id` = locale objects, `srcDir` = the UI source folder, `allowSame` = values/keys allowed to match in both languages.
export function runChecks({ en, id, srcDir, allowSame = [], rootDir = STUDIO }) {
  const errors = [];
  const warnings = [];
  const rel = (f) => path.relative(rootDir, f).split(path.sep).join('/');

  // 1. Key parity
  const enKeys = Object.keys(en);
  const idKeys = new Set(Object.keys(id));
  for (const k of enKeys) if (!idKeys.has(k)) errors.push(`locales/id.json  untranslated key: ${k}`);
  for (const k of idKeys) if (!Object.hasOwn(en, k)) errors.push(`locales/id.json  key missing from en.json: ${k}`);
  const allow = new Set(allowSame);
  for (const [name, dict] of [['en', en], ['id', id]]) {
    for (const [k, v] of Object.entries(dict)) if (typeof v !== 'string' || v.trim() === '') errors.push(`locales/${name}.json  empty value: ${k}`);
  }
  // Plural forms: `<base>.one` and `<base>.other` must always come as a pair in both languages.
  for (const [name, dict] of [['en', en], ['id', id]]) {
    for (const k of Object.keys(dict)) {
      const m = /^(.+)\.(one|other)$/.exec(k);
      if (m && !Object.hasOwn(dict, `${m[1]}.${m[2] === 'one' ? 'other' : 'one'}`)) errors.push(`locales/${name}.json  incomplete plural form (needs .one and .other): ${m[1]}`);
    }
  }
  for (const k of enKeys) {
    if (!Object.hasOwn(id, k)) continue;
    if (en[k] === id[k] && !allow.has(k) && !allow.has(en[k])) errors.push(`locales/id.json  value identical to en (add it to i18n-allow-same.json if intentional): ${k}`);
    if (vars(en[k]) !== vars(id[k])) errors.push(`locales/id.json  placeholders differ from en: ${k}`);
  }

  // 2. Keys used / defined
  const files = walk(srcDir).filter((f) => !f.startsWith(path.join(srcDir, 'i18n') + path.sep));
  const namespaces = new Set(enKeys.map((k) => k.split('.')[0]));
  const used = new Set();
  const hardcoded = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const lines = codeLines(source);
    lines.forEach((line, i) => {
      const seen = new Set([...line.matchAll(T_CALL_RE)].map((m) => m[1]));
      // Keys stored as data (label: 'canvas.node.agent.label') count as used too.
      for (const m of line.matchAll(QUOTED_RE)) if (isKeyLiteral(m[2]) && namespaces.has(m[2].split('.')[0])) seen.add(m[2]);
      for (const key of seen) {
      // A dynamic prefix (codeText(t, 'setup.code', ...)): every key beneath it counts as used.
        if (!Object.hasOwn(en, key) && enKeys.some((k) => k.startsWith(`${key}.`))) {
          for (const k of enKeys) if (k.startsWith(`${key}.`)) used.add(k);
          continue;
        }
        used.add(key);
        if (!Object.hasOwn(en, key)) errors.push(`${rel(file)}:${i + 1}  key missing from en.json: ${key}`);
      }
    });
    hardcoded.push(...scanHardcoded(file, source));
  }
  for (const k of enKeys) {
    if (!used.has(k) && !k.startsWith('error.')) warnings.push(`locales/en.json  unused key: ${k}`);
  }

  // 3. Hardcoded strings
  for (const h of hardcoded) errors.push(`${rel(h.file)}:${h.line}  ${h.why}: ${h.snippet}`);
  return { errors, warnings };
}

function main() {
  const localeDir = path.join(STUDIO, 'web/src/i18n/locales');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8'));
  const allowFile = path.join(HERE, 'i18n-allow-same.json');
  const allowSame = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')) : [];
  const { errors, warnings } = runChecks({ en: read('en.json'), id: read('id.json'), srcDir: path.join(STUDIO, 'web/src'), allowSame });
  for (const w of warnings) console.warn(`warning  ${w}`);
  for (const e of errors) console.error(e);
  if (errors.length) {
    console.error(`\ni18n:check FAILED: ${errors.length} finding(s)`);
    process.exit(1);
  }
  console.log(`i18n:check OK (${Object.keys(read('en.json')).length} keys, ${warnings.length} warnings)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
