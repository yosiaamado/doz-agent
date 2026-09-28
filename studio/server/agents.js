import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { AGENTS_DIR, SKILLS_DIR } from './config.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Claude Code membaca frontmatter dengan longgar (mis. description berisi ": "), jadi YAML ketat
// dicoba dulu lalu jatuh ke parser baris `key: value`.
function parseFrontmatter(raw) {
  try {
    return YAML.parse(raw) ?? {};
  } catch {
    const meta = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return meta;
  }
}

export function parseAgentFile(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return null;
  const meta = parseFrontmatter(m[1]);
  const tools = typeof meta.tools === 'string' ? meta.tools.split(',').map((t) => t.trim()).filter(Boolean) : meta.tools ?? [];
  return { ...meta, tools, prompt: m[2].trim() };
}

export function listAgents(dir = AGENTS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const agent = parseAgentFile(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!agent) return null;
      return {
        name: agent.name ?? path.basename(f, '.md'),
        description: agent.description ?? '',
        tools: agent.tools,
        model: agent.model ?? null,
        effort: agent.effort ?? null,
        maxTurns: agent.maxTurns ?? null,
        color: agent.color ?? null,
        canEdit: agent.tools.some((t) => t === 'Edit' || t === 'Write'),
        prompt: agent.prompt,
        file: path.join('plugins/agents', f),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listSkills(dir = SKILLS_DIR) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const area of fs.readdirSync(dir)) {
    const areaDir = path.join(dir, area);
    if (!fs.statSync(areaDir).isDirectory()) continue;
    for (const name of fs.readdirSync(areaDir)) {
      const file = path.join(areaDir, name, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const meta = parseAgentFile(fs.readFileSync(file, 'utf8'));
      out.push({ name: `doz-agent:${meta?.name ?? name}`, area, description: meta?.description ?? '', file });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
