import path from 'node:path';
import os from 'node:os';

export function isInside(dir, file) {
  const rel = path.relative(dir, file);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

// A short path for display: relative to the workdir/repo/home, otherwise the last two segments.
export function displayPath(file, { workdir, repoRoot } = {}) {
  if (!file) return '';
  if (workdir && (file === workdir || isInside(workdir, file))) return `{workdir}${file === workdir ? '' : `/${toPosix(path.relative(workdir, file))}`}`;
  if (repoRoot && isInside(repoRoot, file)) return toPosix(path.relative(repoRoot, file));
  const home = os.homedir();
  if (file === home || isInside(home, file)) return `~${file === home ? '' : `/${toPosix(path.relative(home, file))}`}`;
  return file;
}

export function shortName(dir) {
  const parts = path.resolve(dir).split(/[/\\]+/).filter(Boolean);
  return parts.slice(-2).join('/') || dir;
}
