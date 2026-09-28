// Ringkasan satu baris untuk pemanggilan tool, dipakai kedua runner supaya tampilan di canvas seragam.
export function describeTool(name, input = {}) {
  const pick = input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.skill ?? input.name ?? input.description ?? input.query;
  const detail = pick ? String(pick).replace(/\s+/g, ' ').slice(0, 160) : '';
  return detail ? `${name}: ${detail}` : name;
}

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'write_file', 'edit_file']);

// Path relatif file yang diubah tool, untuk daftar file per node saat workdir bukan repo git.
export function touchedFile(name, input = {}, workdir = '') {
  if (!WRITE_TOOLS.has(name)) return undefined;
  const p = input.file_path ?? input.notebook_path ?? input.path;
  if (!p) return undefined;
  return String(p).startsWith(`${workdir}/`) ? String(p).slice(workdir.length + 1) : String(p);
}
