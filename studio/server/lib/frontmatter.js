// Helpers for markdown files with YAML frontmatter (agent, skill, action, workflow).
import YAML from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Claude Code parses frontmatter loosely (e.g. a description containing ": "), so strict YAML
// is tried first and then falls back to a line-based `key: value` parser.
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

// Changes frontmatter keys without dropping the other keys and comments. An empty value = delete the key.
// The name is never changed through an edit (renaming = a new file).
export function composeFile(existingText, patch, body) {
  const current = existingText ? splitFile(existingText) : { raw: '', body: '' };
  const doc = current.raw ? YAML.parseDocument(current.raw) : new YAML.Document({});
  if (doc.errors.length) throw new Error('The frontmatter of this file is not strict YAML. Edit it in Raw mode.');
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === 'name' && existingText) continue;
    if (isEmpty(value)) doc.delete(key);
    else doc.set(key, value);
  }
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${(body ?? current.body).trim()}\n`;
}
