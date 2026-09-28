// Field form editor komponen per jenis (agent / skill / action).
import Select from '../../components/ui/Select.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { AGENT_COLORS } from '../../lib/model.js';

const TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Agent'];
const MODEL_OPTIONS = [{ value: '', label: 'Inherit (ikut sesi)' }, ...['opus', 'sonnet', 'haiku'].map((m) => ({ value: m, label: m }))];
const EFFORT_OPTIONS = [{ value: '', label: 'Bawaan' }, ...['low', 'medium', 'high', 'xhigh', 'max'].map((m) => ({ value: m, label: m }))];

function AgentFields({ form, set }) {
  const tools = form.tools ?? [];
  return (
    <>
      <div className="row">
        <Field label="Model"><Select value={form.model ?? ''} options={MODEL_OPTIONS} onChange={(v) => set('model', v || null)} /></Field>
        <Field label="Effort"><Select value={form.effort ?? ''} options={EFFORT_OPTIONS} onChange={(v) => set('effort', v || null)} /></Field>
      </div>
      <Field label="Max Turns">
        <input type="number" min="1" value={form.maxTurns ?? ''} onChange={(e) => set('maxTurns', e.target.value)} />
      </Field>
      <Field label="Warna">
        <div className="swatches">
          {Object.entries(AGENT_COLORS).map(([c, hex]) => (
            <button type="button" key={c} title={c} aria-label={`Warna ${c}`} className={`swatch ${form.color === c ? 'active' : ''}`} style={{ background: hex }} onClick={() => set('color', c)} />
          ))}
        </div>
      </Field>
      <Field label="Tools" hint="Edit/Write = agent bisa mengubah file">
        <div className="tool-grid">
          {TOOLS.map((t) => (
            <label key={t} className="check">
              <input type="checkbox" checked={tools.includes(t)} onChange={(e) => set('tools', e.target.checked ? [...tools, t] : tools.filter((x) => x !== t))} />
              {t}
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}

function NewTarget({ kind, target, setTarget, dirs }) {
  return (
    <>
      <Field label="Nama" hint="Huruf kecil, angka, - (jadi nama file)">
        <input autoFocus value={target.name} onChange={(e) => setTarget({ ...target, name: e.target.value.trim() })} />
      </Field>
      <Field label="Simpan di Folder">
        <Select value={target.dir} onChange={(dir) => setTarget({ ...target, dir })}
          options={dirs.map((d) => ({ value: d.path, label: d.entry, description: d.exists ? d.path : 'folder akan dibuat' }))} />
      </Field>
      {kind === 'skills' && (
        <Field label="Bidang (Subfolder, Opsional)" hint="mis. engineering, product">
          <input value={target.area} onChange={(e) => setTarget({ ...target, area: e.target.value.trim() })} />
        </Field>
      )}
    </>
  );
}

export default function ComponentForm({ kind, isNew, form, set, target, setTarget, dirs, body, setBody }) {
  const bodyLabel = { agents: 'System Prompt (Isi Agent)', skills: 'Isi SKILL.md', actions: 'Catatan' }[kind];
  return (
    <div className="editor-grid">
      <div className="editor-fields">
        {isNew && <NewTarget kind={kind} target={target} setTarget={setTarget} dirs={dirs} />}
        <Field label="Deskripsi" hint={kind === 'actions' ? null : 'Claude Code memakai ini untuk memutuskan kapan komponen dipanggil'}>
          <textarea rows={kind === 'actions' ? 2 : 5} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {kind === 'agents' && <AgentFields form={form} set={set} />}
        {kind === 'skills' && (
          <Field label="Argument Hint" hint='mis. "<deskripsi fitur>"'>
            <input value={form['argument-hint'] ?? ''} onChange={(e) => set('argument-hint', e.target.value)} />
          </Field>
        )}
        {kind === 'actions' && (
          <>
            <Field label="Perintah" hint="Dijalankan di folder project. Exit 0 = PASS.">
              <textarea className="mono" rows={3} value={form.command ?? ''} onChange={(e) => set('command', e.target.value)} />
            </Field>
            <Field label="Timeout (Menit)">
              <input type="number" min="1" value={form.timeout_min ?? ''} onChange={(e) => set('timeout_min', e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <Field label={bodyLabel}>
        <textarea className="mono editor-prompt" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
      </Field>
    </div>
  );
}
