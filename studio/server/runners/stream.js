// Turns the stream-json events of `claude -p` into activity events, usage and the final result.
import { describeTool, touchedFile, describeSkill, todoSummary, isPermissionDenial, SUBAGENT_TOOLS } from './activity.js';

export function toUsage(u) {
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}

export function sumUsage(list) {
  return list.reduce((acc, u) => ({
    input: acc.input + u.input, output: acc.output + u.output, cacheRead: acc.cacheRead + u.cacheRead, cacheWrite: acc.cacheWrite + u.cacheWrite,
  }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
}

export const emptyStreamState = () => ({ result: null, lastText: '', usageById: {}, sessionId: null, tools: {}, blocked: {} });

const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const resultText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.every((c) => typeof c?.text === 'string')) return content.map((c) => c.text).join('');
  return JSON.stringify(content ?? '');
};

function initActivity(ev) {
  const init = compact({
    model: ev.model,
    sessionId: ev.session_id,
    apiKeySource: ev.apiKeySource,
    permissionMode: ev.permissionMode,
    cwd: ev.cwd,
    mcpServers: Array.isArray(ev.mcp_servers) ? ev.mcp_servers.map((s) => ({ name: s.name, status: s.status })) : undefined,
    tools: Array.isArray(ev.tools) ? ev.tools.length : undefined,
  });
  return { kind: 'init', text: `model ${ev.model}`, model: ev.model, session: ev.session_id, init };
}

function toolUseActivity(block, parentId, workdir) {
  const input = block.input ?? {};
  const base = { toolUseId: block.id, parentId };
  if (SUBAGENT_TOOLS.has(block.name)) {
    const agent = input.subagent_type ?? 'general-purpose';
    return { kind: 'subagent_start', ...base, agent, text: `${agent}: ${input.description ?? String(input.prompt ?? '').slice(0, 120)}`.slice(0, 400) };
  }
  if (block.name === 'Skill') {
    const skill = describeSkill(input);
    return { kind: 'skill', ...base, tool: 'Skill', skill, text: `Skill: ${skill}` };
  }
  if (block.name === 'TodoWrite') {
    const list = Array.isArray(input.todos) ? input.todos : [];
    const todos = list.slice(0, 50).map((t) => compact({
      content: String(t?.content ?? '').slice(0, 200),
      status: t?.status,
      activeForm: t?.activeForm === undefined ? undefined : String(t.activeForm).slice(0, 200),
    }));
    return { kind: 'todo', ...base, tool: 'TodoWrite', todos, text: todoSummary(list) };
  }
  return {
    kind: 'tool', ...base, tool: block.name,
    text: describeTool(block.name, input).replaceAll(`${workdir}/`, ''),
    file: touchedFile(block.name, input, workdir),
  };
}

function toolResultActivity(block, ev, tools) {
  const known = tools[block.tool_use_id];
  const text = resultText(block.content);
  if (known && SUBAGENT_TOOLS.has(known.name)) {
    return { kind: 'subagent_end', toolUseId: block.tool_use_id, parentId: known.parentId, isError: Boolean(block.is_error), text: text.slice(0, 200) };
  }
  if (!block.is_error) return null;
  return {
    kind: isPermissionDenial(text) ? 'blocked' : 'tool_error',
    toolUseId: block.tool_use_id, tool: known?.name, parentId: ev.parent_tool_use_id ?? known?.parentId ?? null, text: text.slice(0, 300),
  };
}

// Reads one stream-json event and forwards it to the callbacks. Returns the new state.
export function reduceStreamEvent(rawState, ev, { workdir, onActivity, onUsage, onRateLimit } = {}) {
  const state = { ...emptyStreamState(), ...rawState };
  const emit = (activity) => onActivity?.(compact(activity));

  if (ev.type === 'result' || (ev.total_cost_usd !== undefined && ev.usage)) {
    const blocked = { ...state.blocked };
    for (const d of ev.permission_denials ?? []) {
      if (d?.tool_use_id && blocked[d.tool_use_id]) continue;
      if (d?.tool_use_id) blocked[d.tool_use_id] = true;
      emit({ kind: 'blocked', toolUseId: d?.tool_use_id, tool: d?.tool_name, parentId: null, text: `${d?.tool_name ?? 'tool'}: permission denied`.slice(0, 300) });
    }
    return { ...state, result: ev, blocked };
  }
  if (ev.type === 'rate_limit_event' && ev.rate_limit_info) {
    const info = ev.rate_limit_info;
    onRateLimit?.(info);
    if (info.status !== 'allowed') {
      emit({
        kind: 'rate_limit', text: `rate limit ${info.status} (${info.rateLimitType})`,
        rateLimit: compact({ status: info.status, rateLimitType: info.rateLimitType, resetsAt: info.resetsAt, utilization: info.utilization }),
      });
    }
    return state;
  }
  if (ev.type === 'system' && ev.subtype === 'init') {
    emit(initActivity(ev));
    return { ...state, sessionId: ev.session_id ?? state.sessionId };
  }
  if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
    const blocked = { ...state.blocked };
    for (const block of ev.message.content) {
      if (block.type !== 'tool_result') continue;
      const activity = toolResultActivity(block, ev, state.tools);
      if (!activity) continue;
      if (activity.kind === 'blocked' && activity.toolUseId) blocked[activity.toolUseId] = true;
      emit(activity);
    }
    return { ...state, blocked };
  }
  if (ev.type !== 'assistant' || !ev.message) return state;

  let next = state;
  if (ev.message.usage && ev.message.id) {
    const usageById = { ...state.usageById, [ev.message.id]: toUsage(ev.message.usage) };
    next = { ...next, usageById };
    onUsage?.(sumUsage(Object.values(usageById)));
  }
  const parentId = ev.parent_tool_use_id ?? null;
  const tools = { ...next.tools };
  for (const block of ev.message.content ?? []) {
    if (block.type === 'tool_use') {
      tools[block.id] = { name: block.name, parentId };
      emit(toolUseActivity(block, parentId, workdir));
    }
    if (block.type === 'text' && block.text.trim()) {
      // Subagent chatter must not become the node's output.
      if (parentId === null) next = { ...next, lastText: block.text };
      emit({ kind: 'text', parentId, text: block.text.slice(0, 400) });
    }
  }
  return { ...next, tools };
}

export function toRunResult(state) {
  const result = state.result;
  const maxTurns = result.subtype === 'error_max_turns';
  if (result.is_error && !maxTurns) throw new Error(String(result.result ?? result.subtype ?? 'error').slice(0, 500));
  return {
    output: result.result ?? state.lastText,
    cost: result.total_cost_usd ?? 0,
    usage: result.usage ? toUsage(result.usage) : null,
    turns: result.num_turns,
    warning: maxTurns ? 'stopped at max_turns, the result may be incomplete' : undefined,
    warningCode: maxTurns ? 'MAX_TURNS_REACHED' : undefined,
    sessionId: state.sessionId ?? result.session_id ?? null,
  };
}
