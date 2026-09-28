// Penjelajah folder ala file manager untuk memilih workdir / folder sumber dari UI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { badRequest } from '../lib/errors.js';
import { displayPath, shortName } from '../lib/paths.js';

const MARKERS = ['.git', 'package.json', '.claude', 'pyproject.toml', 'go.mod', 'Cargo.toml', '*.sln', '*.csproj'];

function windowsDrives() {
  return 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`).filter((d) => fs.existsSync(d));
}

function markersIn(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return MARKERS.filter((m) => (m.startsWith('*') ? names.some((n) => n.endsWith(m.slice(1))) : names.includes(m)));
}

export function createFolderService(config) {
  const show = (p) => displayPath(p, { workdir: config.getWorkdir(), repoRoot: config.repoRoot });

  const roots = () => {
    const home = os.homedir();
    const base = [
      { label: 'Home', path: home },
      { label: 'Project aktif', path: config.getWorkdir() },
      { label: 'Repo doz-agent', path: config.repoRoot },
    ];
    const drives = process.platform === 'win32'
      ? windowsDrives().map((d) => ({ label: d.slice(0, 2), path: d }))
      : [{ label: '/', path: '/' }];
    return [...base, ...drives];
  };

  const list = (target) => {
    const dir = path.resolve(target || config.getWorkdir());
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      throw badRequest(`Tidak bisa membuka folder: ${err.code ?? err.message}`);
    }
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.dirname(dir);
    return {
      path: dir,
      display: show(dir),
      name: shortName(dir),
      parent: parent === dir ? null : parent,
      segments: dir.split(/[/\\]+/).filter(Boolean),
      markers: markersIn(dir),
      folders,
      roots: roots(),
    };
  };

  return { list, display: show };
}
