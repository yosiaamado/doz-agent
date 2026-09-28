// Menyusun prompt untuk satu node dari: catatan workflow, input start, node info, output node sebelumnya, umpan balik loop.

export const VERDICT_INSTRUCTION =
  'Akhiri jawabanmu dengan satu baris terpisah persis: `VERDICT: PASS` (lolos, boleh lanjut) atau `VERDICT: FAIL` (belum lolos). Jelaskan alasannya di atas baris itu.';

export function parseVerdict(text) {
  const matches = [...String(text ?? '').matchAll(/VERDICT:\s*\**\s*(PASS|FAIL)\b/gi)];
  if (!matches.length) return null;
  return matches.at(-1)[1].toUpperCase() === 'PASS';
}

export function truncate(text, max) {
  const s = String(text ?? '');
  if (!max || s.length <= max) return s;
  const head = Math.floor(max * 0.3);
  return `${s.slice(0, head)}\n\n[... ${s.length - max} karakter dipotong ...]\n\n${s.slice(s.length - (max - head))}`;
}

// ctx: { wf, node, settings, input, upstream: [{node, output}], infos: [text], feedback: {attempt, from, output} | null }
export function buildNodePrompt(ctx) {
  const { wf, node, settings, input, upstream, infos, feedback } = ctx;
  const parts = [`# Workflow: ${wf.name}`];
  if (wf.description) parts.push(wf.description);
  if (wf.notes) parts.push(`## Catatan workflow\n${wf.notes}`);
  parts.push(`## Permintaan\n${input || '(kosong)'}`);
  if (infos.length) parts.push(`## Konteks tambahan\n${infos.map((t) => `- ${t}`).join('\n')}`);
  if (upstream.length) {
    const blocks = upstream.map(({ node: n, output }) =>
      `### ${n.label || n.id}${n.agent ? ` (${n.agent})` : ''}\n${truncate(output, settings.max_output_chars)}`);
    parts.push(`## Hasil langkah sebelumnya\n${blocks.join('\n\n')}`);
  }
  if (feedback) {
    parts.push(`## Umpan balik (percobaan ke-${feedback.attempt})\nLangkah "${feedback.from}" belum lolos. Perbaiki berdasarkan ini:\n\n${truncate(feedback.output, settings.max_output_chars)}`);
  }
  parts.push(`## Tugasmu di langkah ini\n${node.instructions?.trim() || 'Kerjakan sesuai peranmu terhadap permintaan di atas.'}`);
  if (node.verdict) parts.push(VERDICT_INSTRUCTION);
  return parts.join('\n\n');
}

export function buildJudgePrompt({ question, subject }) {
  return [
    'Kamu penilai. Jawab pertanyaan berikut hanya berdasarkan teks yang diberikan.',
    `Pertanyaan: ${question}`,
    `Teks:\n"""\n${subject}\n"""`,
    'Balas dengan satu baris terpisah persis `VERDICT: PASS` kalau jawabannya ya, atau `VERDICT: FAIL` kalau tidak, didahului satu kalimat alasan.',
  ].join('\n\n');
}
