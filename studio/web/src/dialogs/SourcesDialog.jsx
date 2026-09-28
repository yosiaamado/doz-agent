import { useState } from 'react';
import { Plus, Trash2, X, CheckCircle2, CircleDashed } from 'lucide-react';

const KINDS = [
  ['agents', 'Agent', ['plugins/agents', '{workdir}/.claude/agents', '~/.claude/agents']],
  ['skills', 'Skill', ['plugins/skills', '{workdir}/.claude/skills', '~/.claude/skills']],
  ['actions', 'Action', ['plugins/actions', '{workdir}/.claude/actions']],
  ['workflows', 'Workflow', ['plugins/workflows', '{workdir}/.claude/workflows']],
];

export default function SourcesDialog({ sources, onClose, onSave }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(KINDS.map(([k]) => [k, (sources[k] ?? []).map((s) => s.entry)])));
  const [saving, setSaving] = useState(false);
  const info = (kind, entry) => sources[kind]?.find((s) => s.entry === entry);
  const update = (kind, list) => setDraft({ ...draft, [kind]: list });

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <div>
            <div className="editor-title">Folder yang dibaca</div>
            <div className="muted small">
              Path relatif = dari root repo doz-agent. <code>{'{workdir}'}</code> = folder project aktif, <code>~</code> = home.
              Folder paling atas jadi tujuan file baru. Nama sama di dua folder → yang di atas dipakai.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sources">
          {KINDS.map(([kind, label, suggestions]) => (
            <div key={kind} className="source-group">
              <div className="subhead">{label}</div>
              {draft[kind].map((entry, i) => {
                const it = info(kind, entry);
                return (
                  <div key={i} className="source-row">
                    {it?.exists ? <CheckCircle2 size={14} className="ok" /> : <CircleDashed size={14} className="muted" />}
                    <input value={entry} onChange={(e) => update(kind, draft[kind].map((x, j) => (j === i ? e.target.value : x)))} />
                    <button type="button" className="icon-btn" title="Hapus" onClick={() => update(kind, draft[kind].filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </div>
                );
              })}
              <div className="source-add">
                {suggestions.filter((s) => !draft[kind].includes(s)).map((s) => (
                  <button type="button" key={s} className="chip-btn" onClick={() => update(kind, [...draft[kind], s])}><Plus size={12} /> {s}</button>
                ))}
                <button type="button" className="chip-btn" onClick={() => update(kind, [...draft[kind], ''])}><Plus size={12} /> path lain</button>
              </div>
            </div>
          ))}
        </div>
        <div className="editor-foot">
          <span className="muted small">Folder yang belum ada ditandai ○ dan dilewati sampai dibuat.</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}
