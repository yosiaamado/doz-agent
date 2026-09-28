import { Trash2, X } from 'lucide-react';
import Select from '../../components/ui/Select.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { TypeIcon } from '../../components/icons.jsx';
import { NODE_META, BRANCHING } from '../../lib/model.js';
import NodeSettings from './NodeSettings.jsx';
import SettingsFields from './SettingsFields.jsx';
import { opt } from './options.js';

function EdgeSettings({ edge, sourceType, update, remove }) {
  const data = edge.data ?? {};
  return (
    <>
      {BRANCHING.has(sourceType) ? (
        <>
          <Field label="Cabang">
            <Select value={String(data.when)} onChange={(v) => update({ ...data, when: v === 'true' })}
              options={[opt('true', 'Ya', 'PASS / disetujui'), opt('false', 'Tidak', 'FAIL / ditolak')]} />
          </Field>
          <Field label="Loop (Ulang Maks)" hint="Isi kalau garis ini kembali ke langkah sebelumnya. Node tujuan dan turunannya diulang dengan umpan balik.">
            <input type="number" min="0" max="10" value={data.loop ?? ''} onChange={(e) => update({ ...data, loop: Number(e.target.value) || undefined })} />
          </Field>
        </>
      ) : <p className="muted small">Output {edge.source} mengalir ke {edge.target}. Cabang dan loop hanya bisa dari Condition/Approval.</p>}
      <button type="button" className="btn btn-danger" style={{ marginTop: 18 }} onClick={remove}><Trash2 size={14} /> Hapus Garis</button>
    </>
  );
}

function WorkflowSettings({ meta, setMeta, runners }) {
  const set = (key, value) => setMeta({ ...meta, [key]: value });
  const setDefault = (key, value) => setMeta({ ...meta, defaults: { ...meta.defaults, [key]: value } });
  return (
    <>
      <Field label="Deskripsi"><textarea rows={2} value={meta.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
      <Field label="Catatan untuk Semua Agent" hint="Body file .md. Ikut dikirim di setiap prompt.">
        <textarea rows={4} value={meta.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <div className="row">
        <Field label="Paralel Maks"><input type="number" min="1" max="8" value={meta.parallel ?? 3} onChange={(e) => set('parallel', Number(e.target.value) || 3)} /></Field>
        <Field label="Budget Run ($)" hint="Run berhenti kalau lewat">
          <input type="number" min="0" step="1" value={meta.budget_usd ?? ''} onChange={(e) => set('budget_usd', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      </div>
      <p className="muted small">Default di bawah berlaku untuk semua node Agent/Skill kecuali di-override di node.</p>
      <SettingsFields target={meta.defaults ?? {}} set={setDefault} meta={meta} isDefaults runners={runners} />
    </>
  );
}

export default function SettingsPanel({ selection, ctx, onNodeChange, onEdgeChange, onDelete, meta, setMeta, onClose, onEditComponent }) {
  let title;
  let body;
  if (selection?.kind === 'node') {
    const n = selection.node;
    title = <><TypeIcon type={n.type} size={16} /> {n.label || NODE_META[n.type].label} <span className="muted small">#{n.id}</span></>;
    body = <NodeSettings node={n} ctx={ctx} update={onNodeChange} remove={onDelete} onEditComponent={onEditComponent} />;
  } else if (selection?.kind === 'edge') {
    title = <>Garis {selection.edge.source} → {selection.edge.target}</>;
    body = <EdgeSettings edge={selection.edge} sourceType={selection.sourceType} update={onEdgeChange} remove={onDelete} />;
  } else {
    title = <>Pengaturan Workflow</>;
    body = <WorkflowSettings meta={meta} setMeta={setMeta} runners={ctx.runners} />;
  }
  return (
    <aside className="rpanel" aria-label="Pengaturan">
      <div className="rpanel-head">
        <span className="rpanel-title">{title}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={16} /></button>
      </div>
      <div className="rpanel-body">{body}</div>
    </aside>
  );
}
