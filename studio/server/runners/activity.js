// Ringkasan satu baris untuk pemanggilan tool, dipakai kedua runner supaya tampilan di canvas seragam.
export function describeTool(name, input = {}) {
  const pick = input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.skill ?? input.name ?? input.description ?? input.query;
  const detail = pick ? String(pick).replace(/\s+/g, ' ').slice(0, 160) : '';
  return detail ? `${name}: ${detail}` : name;
}
