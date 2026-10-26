// A one-line summary for a tool call, used by both runners so the canvas looks the same either way.
export function describeTool(name, input = {}) {
  const pick = input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.skill ?? input.name ?? input.description ?? input.query;
  const detail = pick ? String(pick).replace(/\s+/g, ' ').slice(0, 160) : '';
  return detail ? `${name}: ${detail}` : name;
}

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'write_file', 'edit_file']);

// The relative paths of the files a tool changed, for the per-node file list when the workdir is not a git repo.
export function touchedFile(name, input = {}, workdir = '') {
  if (!WRITE_TOOLS.has(name)) return undefined;
  const p = input.file_path ?? input.notebook_path ?? input.path;
  if (!p) return undefined;
  return String(p).startsWith(`${workdir}/`) ? String(p).slice(workdir.length + 1) : String(p);
}

export const SUBAGENT_TOOLS = new Set(['Task', 'Agent']);

export const describeSkill = (input = {}) => input.skill ?? input.command ?? null;

export const todoSummary = (todos = []) => `Todo ${todos.filter((t) => t?.status === 'completed').length}/${todos.length}`;

// In -p mode an unapproved tool call comes back as an is_error tool_result worded like this.
export const isPermissionDenial = (text) => /permission|haven't granted|not allowed|denied/i.test(String(text ?? ''));
