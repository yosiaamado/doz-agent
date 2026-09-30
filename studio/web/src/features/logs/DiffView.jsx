import { useI18n } from '../../i18n/I18nProvider.jsx';

// A unified diff view with old/new line numbers.
export default function DiffView({ text }) {
  const { t } = useI18n();
  if (!text?.trim()) return <div className="empty">{t('logs.diff.none')}</div>;
  const rows = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git')) {
      rows.push({ kind: 'file', text: line.replace(/^diff --git a\/(.*) b\/.*/, '$1') });
    } else if (/^(index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(line)) {
      continue;
    } else if (line.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
      oldNo = Number(m?.[1] ?? 0);
      newNo = Number(m?.[2] ?? 0);
      rows.push({ kind: 'hunk', text: line });
    } else if (line.startsWith('+')) {
      rows.push({ kind: 'add', n: newNo++, text: line.slice(1) });
    } else if (line.startsWith('-')) {
      rows.push({ kind: 'del', o: oldNo++, text: line.slice(1) });
    } else if (line.startsWith('\\')) {
      rows.push({ kind: 'hunk', text: line });
    } else if (line.length || rows.length) {
      rows.push({ kind: 'ctx', o: oldNo++, n: newNo++, text: line.slice(1) });
    }
  }
  return (
    <div className="diff">
      {rows.map((r, i) => (
        r.kind === 'file' || r.kind === 'hunk'
          ? <div key={i} className={`diff-${r.kind}`}>{r.text}</div>
          : (
            <div key={i} className={`diff-row diff-${r.kind}`}>
              <span className="ln">{r.o ?? ''}</span>
              <span className="ln">{r.n ?? ''}</span>
              <span className="sign">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span>
              <span className="code">{r.text}</span>
            </div>
          )
      ))}
    </div>
  );
}
