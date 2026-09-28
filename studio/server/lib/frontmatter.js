// Utilitas file markdown dengan frontmatter YAML (agent, skill, action, workflow).
import YAML from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Claude Code membaca frontmatter dengan longgar (mis. description berisi ": "), jadi YAML ketat
// dicoba dulu lalu jatuh ke parser baris `key: value`.
export function parseFrontmatter(raw) {
  try {
    return { meta: YAML.parse(raw) ?? {}, strict: true };
  } catch {
    const entries = raw.split(/\r?\n/)
      .map((line) => /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]);
    return { meta: Object.fromEntries(entries), strict: false };
  }
}

export function splitFile(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return { raw: '', meta: {}, body: text, strict: true };
  return { raw: m[1], body: m[2].replace(/^\r?\n/, ''), ...parseFrontmatter(m[1]) };
}

const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

// Mengubah key frontmatter tanpa membuang key lain dan komentar. Nilai kosong = hapus key.
// Nama tidak ikut diubah lewat edit (ganti nama = file baru).
export function composeFile(existingText, patch, body) {
  const current = existingText ? splitFile(existingText) : { raw: '', body: '' };
  const doc = current.raw ? YAML.parseDocument(current.raw) : new YAML.Document({});
  if (doc.errors.length) throw new Error('Frontmatter file ini bukan YAML ketat. Edit lewat mode Raw.');
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === 'name' && existingText) continue;
    if (isEmpty(value)) doc.delete(key);
    else doc.set(key, value);
  }
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${(body ?? current.body).trim()}\n`;
}
