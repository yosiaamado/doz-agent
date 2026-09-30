// A runner that goes through the Claude API (ANTHROPIC_API_KEY) with local tools (tools.js).
// Does not need Claude Code installed, but skills can only be loaded through the load_skill tool.
import Anthropic from '@anthropic-ai/sdk';
import { toolsFor, runTool } from './tools.js';
import { describeTool, touchedFile } from './activity.js';
import { CodedError } from '../lib/errors.js';

const ALIASES = { opus: 'claude-opus-5', sonnet: 'claude-sonnet-5', haiku: 'claude-haiku-4-5' };
const DEFAULT_MODEL = 'claude-opus-5';

// $ per 1 million tokens: [input, output]. Cache read ~ 0.1x input, cache write ~ 1.25x input.
const PRICES = {
  'claude-fable-5-1': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
};

export function resolveModel(model) {
  if (!model) return DEFAULT_MODEL;
  return ALIASES[model] ?? model;
}

export function estimateCost(model, usage) {
  const [inp, out] = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  return ((usage.input * inp) + (usage.cacheRead * inp * 0.1) + (usage.cacheWrite * inp * 1.25) + (usage.output * out)) / 1e6;
}

export function apiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

// Called after the API key is changed from the UI so the next client uses the new key.
export function resetClient() {
  client = undefined;
}

// The smallest possible call that proves the API key works.
export async function testApiConnection() {
  const model = resolveModel('haiku');
  const started = Date.now();
  const response = await getClient().messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with one word: ok' }] });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return { model: response.model, reply: text, ms: Date.now() - started };
}

function requestParams(model, settings) {
  const params = { model, max_tokens: 16000 };
  // Haiku 4.5 does not support effort.
  if (settings.effort && !model.startsWith('claude-haiku')) params.output_config = { effort: String(settings.effort) };
  return params;
}

async function agentLoop({ system, prompt, tools, settings, workdir, signal, onActivity, onUsage, toolContext }) {
  const model = resolveModel(settings.model);
  const maxTurns = Number(settings.max_turns) || 30;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const messages = [{ role: 'user', content: prompt }];
  let lastText = '';
  let turns = 0;
  let warning;
  let warningCode;
  onActivity?.({ kind: 'init', text: `model ${model} (API)`, model });

  while (true) {
    if (turns >= maxTurns) { warning = 'stopped at max_turns, the result may be incomplete'; warningCode = 'MAX_TURNS_REACHED'; break; }
    turns++;
    const response = await getClient().messages.create({
      ...requestParams(model, settings),
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: tools.map(({ name, def }) => ({ name, description: def.description, input_schema: def.input_schema })),
      messages,
    }, { signal });

    usage.input += response.usage.input_tokens ?? 0;
    usage.output += response.usage.output_tokens ?? 0;
    usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
    onUsage?.({ ...usage });
    const cost = estimateCost(model, usage);
    if (settings.budget_usd && cost > settings.budget_usd) throw new Error(`node budget $${settings.budget_usd} exceeded`);

    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (text) { lastText = text; onActivity?.({ kind: 'text', text: text.slice(0, 400) }); }

    if (response.stop_reason === 'refusal') throw new Error('the model refused the request (refusal)');
    if (response.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: response.content }); continue; }
    if (response.stop_reason !== 'tool_use') {
      if (response.stop_reason === 'max_tokens') { warning = 'output truncated at max_tokens'; warningCode = 'MAX_TOKENS_REACHED'; }
      break;
    }

    messages.push({ role: 'assistant', content: response.content });
    const calls = response.content.filter((b) => b.type === 'tool_use');
    // Every tool_result is returned in a single user message.
    const results = await Promise.all(calls.map(async (call) => {
      onActivity?.({ kind: 'tool', tool: call.name, text: describeTool(call.name, call.input), file: touchedFile(call.name, call.input, workdir) });
      if (!tools.some((t) => t.name === call.name)) {
        return { type: 'tool_result', tool_use_id: call.id, content: `tool ${call.name} is not allowed`, is_error: true };
      }
      try {
        return { type: 'tool_result', tool_use_id: call.id, content: await runTool(call.name, call.input, workdir, toolContext) };
      } catch (err) {
        onActivity?.({ kind: 'tool_error', text: err.message });
        return { type: 'tool_result', tool_use_id: call.id, content: err.message, is_error: true };
      }
    }));
    messages.push({ role: 'user', content: results });
  }

  return { output: lastText, usage, cost: estimateCost(model, usage), turns, warning, warningCode };
}

function describeRequest({ agent, settings }) {
  const tools = toolsFor(agent?.tools, settings.permission).map((t) => t.name);
  const effort = settings.effort ? ` · effort ${settings.effort}` : '';
  return `Claude API · POST /v1/messages · model ${resolveModel(settings.model)}${effort} · max_turns ${Number(settings.max_turns) || 30} · tools: ${tools.join(', ') || '-'}`;
}

function systemPrompt(agent, tools, workdir) {
  return [
    agent?.prompt ?? 'You are an engineering assistant.',
    `\nYou are working in the project folder: ${workdir}. Every path is relative to this folder.`,
    `Available tools: ${tools.map((t) => t.name).join(', ') || '(none)'}. The other Claude Code tools mentioned in your instructions are not available; skills are loaded through load_skill.`,
  ].join('\n');
}

// listSkills: used by the load_skill tool to load SKILL.md from the source folders.
export function createApiRunner({ listSkills = () => [] } = {}) {
  return {
    name: 'api',
    describe: describeRequest,
    run({ node, agent, settings, prompt, workdir, signal, onActivity, onUsage }) {
      if (node.type === 'skill') throw new CodedError('skill nodes can only run with the claude-cli runner', 'SKILL_NEEDS_CLAUDE_CLI');
      const tools = toolsFor(agent?.tools, settings.permission);
      return agentLoop({
        system: systemPrompt(agent, tools, workdir), prompt, tools, settings, workdir, signal, onActivity, onUsage,
        toolContext: { listSkills },
      });
    },
    judge({ prompt, settings, workdir, signal }) {
      return agentLoop({ system: 'You are a concise judge.', prompt, tools: [], settings: { ...settings, max_turns: 1 }, workdir, signal });
    },
  };
}
