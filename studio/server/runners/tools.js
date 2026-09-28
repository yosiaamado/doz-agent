// Tool lokal untuk runner API. Semua path dikurung di workdir.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { listSkills } from '../agents.js';

const MAX_RESULT = 20_000;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'bin', 'obj', '.doz-studio']);

function clip(s) {
  s = String(s);
  return s.length > MAX_RESULT ? `${s.slice(0, MAX_RESULT)}\n[... dipotong, ${s.length - MAX_RESULT} karakter lagi]` : s;
}

export function confine(workdir, p) {
  const root = path.resolve(workdir);
  const abs = path.resolve(root, String(p ?? '.'));
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`path di luar workdir: ${p}`);
  return abs;
}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') re += '(';
    else if (c === '}') re += ')';
    else if (c === ',') re += '|';
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function walk(root, onFile, limit = 5000) {
  let count = 0;
  const stack = [root];
  while (stack.length && count < limit) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(full); }
      else if (e.isFile()) { count++; onFile(full); }
    }
  }
}

function runShell(command, cwd, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'cmd' : 'bash', process.platform === 'win32' ? ['/c', command] : ['-lc', command], { cwd });
    let out = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); out += '\n[timeout]'; }, timeoutMs);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => { clearTimeout(timer); resolve(`exit ${code}\n${clip(out)}`); });
    child.on('error', (err) => { clearTimeout(timer); resolve(`error: ${err.message}`); });
  });
}

const DEFS = {
  read_file: {
    from: 'Read',
    description: 'Baca file teks. Pakai offset/limit (nomor baris) untuk file besar.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } }, required: ['path'] },
    run: ({ path: p, offset = 1, limit = 400 }, wd) => {
      const lines = fs.readFileSync(confine(wd, p), 'utf8').split('\n');
      const start = Math.max(1, offset);
      return clip(lines.slice(start - 1, start - 1 + limit).map((l, i) => `${start + i}\t${l}`).join('\n'));
    },
  },
  glob: {
    from: 'Glob',
    description: 'Cari file berdasarkan pola glob relatif ke workdir, mis. "src/**/*.ts".',
    input_schema: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    run: ({ pattern }, wd) => {
      const re = globToRegExp(pattern);
      const hits = [];
      walk(wd, (f) => { const rel = path.relative(wd, f).split(path.sep).join('/'); if (re.test(rel)) hits.push(rel); });
      return hits.slice(0, 300).join('\n') || '(tidak ada)';
    },
  },
  grep: {
    from: 'Grep',
    description: 'Cari regex di isi file. Hasil: path:baris:isi.',
    input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string' } }, required: ['pattern'] },
    run: ({ pattern, path: p = '.', glob }, wd) => {
      const re = new RegExp(pattern);
      const filter = glob ? globToRegExp(glob) : null;
      const base = confine(wd, p);
      const hits = [];
      const check = (f) => {
        if (hits.length >= 200) return;
        const rel = path.relative(wd, f).split(path.sep).join('/');
        if (filter && !filter.test(path.basename(f)) && !filter.test(rel)) return;
        let text;
        try { if (fs.statSync(f).size > 1_000_000) return; text = fs.readFileSync(f, 'utf8'); } catch { return; }
        text.split('\n').forEach((line, i) => { if (hits.length < 200 && re.test(line)) hits.push(`${rel}:${i + 1}:${line.slice(0, 300)}`); });
      };
      if (fs.statSync(base).isFile()) check(base); else walk(base, check);
      return hits.join('\n') || '(tidak ada)';
    },
  },
  write_file: {
    from: 'Write',
    write: true,
    description: 'Tulis (timpa) seluruh isi file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    run: ({ path: p, content }, wd) => {
      const abs = confine(wd, p);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      return `ditulis ${p} (${content.length} karakter)`;
    },
  },
  edit_file: {
    from: 'Edit',
    write: true,
    description: 'Ganti satu potongan teks yang persis dan unik di file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['path', 'old_string', 'new_string'] },
    run: ({ path: p, old_string: a, new_string: b }, wd) => {
      const abs = confine(wd, p);
      const text = fs.readFileSync(abs, 'utf8');
      const count = text.split(a).length - 1;
      if (count !== 1) throw new Error(`old_string ditemukan ${count}x, harus tepat 1x`);
      fs.writeFileSync(abs, text.replace(a, () => b));
      return `diedit ${p}`;
    },
  },
  bash: {
    from: 'Bash',
    write: true,
    description: 'Jalankan perintah shell di workdir (timeout 2 menit).',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    run: ({ command }, wd) => runShell(command, wd),
  },
  load_skill: {
    from: 'Skill',
    description: 'Muat isi skill doz-agent (mis. "doz-agent:backend-patterns") kalau butuh standar kerjanya.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    run: ({ name }) => {
      const skill = listSkills().find((s) => s.name === name || s.name === `doz-agent:${name}`);
      if (!skill) return `skill tidak ada. Tersedia: ${listSkills().map((s) => s.name).join(', ')}`;
      return clip(fs.readFileSync(skill.file, 'utf8'));
    },
  },
};

// Tool agent (nama Claude Code) → tool lokal. read-only membuang tool yang bisa mengubah sesuatu.
export function toolsFor(agentTools, permission) {
  const names = agentTools?.length ? agentTools : ['Read', 'Grep', 'Glob'];
  return Object.entries(DEFS)
    .filter(([, d]) => names.includes(d.from) && !(permission === 'read-only' && d.write))
    .map(([name, d]) => ({ name, def: d }));
}

export async function runTool(name, input, workdir) {
  const def = DEFS[name];
  if (!def) throw new Error(`tool tidak dikenal: ${name}`);
  return String(await def.run(input ?? {}, workdir));
}
