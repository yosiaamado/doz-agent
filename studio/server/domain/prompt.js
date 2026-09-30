// Builds the prompt for a single node from: workflow notes, start input, node info, previous node output, loop feedback.

export const VERDICT_INSTRUCTION =
  'End your answer with one separate line, exactly: `VERDICT: PASS` (passed, may continue) or `VERDICT: FAIL` (not passed). Explain your reasoning above that line.';

export function parseVerdict(text) {
  const matches = [...String(text ?? '').matchAll(/VERDICT:\s*\**\s*(PASS|FAIL)\b/gi)];
  if (!matches.length) return null;
  return matches.at(-1)[1].toUpperCase() === 'PASS';
}

export function truncate(text, max) {
  const s = String(text ?? '');
  if (!max || s.length <= max) return s;
  const head = Math.floor(max * 0.3);
  return `${s.slice(0, head)}\n\n[... ${s.length - max} characters truncated ...]\n\n${s.slice(s.length - (max - head))}`;
}

// ctx: { wf, node, settings, input, upstream: [{node, output}], infos: [text], feedback: {attempt, from, output} | null }
export function buildNodePrompt(ctx) {
  const { wf, node, settings, input, upstream, infos, feedback } = ctx;
  const parts = [`# Workflow: ${wf.name}`];
  if (wf.description) parts.push(wf.description);
  if (wf.notes) parts.push(`## Workflow notes\n${wf.notes}`);
  parts.push(`## Request\n${input || '(empty)'}`);
  if (infos.length) parts.push(`## Additional context\n${infos.map((t) => `- ${t}`).join('\n')}`);
  if (upstream.length) {
    const blocks = upstream.map(({ node: n, output }) =>
      `### ${n.label || n.id}${n.agent ? ` (${n.agent})` : ''}\n${truncate(output, settings.max_output_chars)}`);
    parts.push(`## Results of previous steps\n${blocks.join('\n\n')}`);
  }
  if (feedback) {
    parts.push(`## Feedback (attempt ${feedback.attempt})\nStep "${feedback.from}" did not pass. Fix it based on this:\n\n${truncate(feedback.output, settings.max_output_chars)}`);
  }
  parts.push(`## Your task in this step\n${node.instructions?.trim() || 'Do your part for the request above, according to your role.'}`);
  if (node.verdict) parts.push(VERDICT_INSTRUCTION);
  return parts.join('\n\n');
}

export function buildJudgePrompt({ question, subject }) {
  return [
    'You are a judge. Answer the following question using only the given text.',
    `Question: ${question}`,
    `Text:\n"""\n${subject}\n"""`,
    'Reply with one separate line, exactly `VERDICT: PASS` if the answer is yes or `VERDICT: FAIL` if not, preceded by one sentence of reasoning.',
  ].join('\n\n');
}
