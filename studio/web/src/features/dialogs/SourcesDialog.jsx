// Folder yang dibaca studio. Folder ditambah lewat pemilih ala file manager; ditampilkan dalam bentuk pendek.
import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, FolderCog, FolderPlus, Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import FolderPicker from './FolderPicker.jsx';

const KINDS = [
  ['agents', 'Agent', ['plugins/agents', '{workdir}/.claude/agents', '~/.claude/agents']],
  ['skills', 'Skill', ['plugins/skills', '{workdir}/.claude/skills', '~/.claude/skills']],
  ['actions', 'Action', ['plugins/actions', '{workdir}/.claude/actions']],
  ['workflows', 'Workflow', ['plugins/workflows', '{workdir}/.claude/workflows']],
];

function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function SourceGroup({ kind, label, suggestions, entries, info, onChange, onBrowse }) {
  return (
    <div className="source-group">
      <div className="subhead">{label}</div>
      {entries.map((entry, i) => {
        const it = info(kind, entry);
        return (
          <div key={entry} className="source-row">
            {it?.exists !== false ? <CheckCircle2 size={14} className="ok" /> : <CircleDashed size={14} className="muted" />}
            <span className="entry" title={it?.path ?? entry}>{entry}</span>
            {i === 0 && <span className="tag">tujuan file baru</span>}
            <button type="button" className="icon-btn" title="Naikkan" onClick={() => onChange(move(entries, i, i - 1))}><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" title="Turunkan" onClick={() => onChange(move(entries, i, i + 1))}><ArrowDown size={14} /></button>
            <button type="button" className="icon-btn" title="Hapus" onClick={() => onChange(entries.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        );
      })}
      <div className="source-add">
        <button type="button" className="chip-btn solid" onClick={onBrowse}><FolderPlus size={12} /> Pilih Folder…</button>
        {suggestions.filter((s) => !entries.includes(s)).map((s) => (
          <button type="button" key={s} className="chip-btn" onClick={() => onChange([...entries, s])}><Plus size={12} /> {s}</button>
        ))}
      </div>
    </div>
  );
}

export default function SourcesDialog({ sources, onClose, onSave }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(KINDS.map(([k]) => [k, (sources[k] ?? []).map((s) => s.entry)])));
  const [browsing, setBrowsing] = useState(null);
  const [saving, setSaving] = useState(false);
  const info = (kind, entry) => sources[kind]?.find((s) => s.entry === entry);
  const update = (kind, list) => setDraft((d) => ({ ...d, [kind]: list }));
  const save = async () => {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <>
      <Modal
        size="lg" title="Folder yang Dibaca" icon={<FolderCog size={18} />} onClose={onClose}
        subtitle="Folder paling atas jadi tujuan file baru. Nama sama di dua folder → yang di atas dipakai."
        footer={(
          <>
            <span className="muted small">○ = folder belum ada, dilewati sampai dibuat.</span>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>Batal</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>Simpan</button>
          </>
        )}
      >
        <div className="sources">
          {KINDS.map(([kind, label, suggestions]) => (
            <SourceGroup key={kind} kind={kind} label={label} suggestions={suggestions} entries={draft[kind]} info={info}
              onChange={(list) => update(kind, list)} onBrowse={() => setBrowsing(kind)} />
          ))}
        </div>
      </Modal>
      {browsing && (
        <FolderPicker
          title={`Tambah Folder ${KINDS.find(([k]) => k === browsing)[1]}`}
          confirmLabel="Tambahkan"
          onClose={() => setBrowsing(null)}
          onPick={(listing) => {
            update(browsing, [...new Set([...draft[browsing], listing.display])]);
            setBrowsing(null);
          }}
        />
      )}
    </>
  );
}
