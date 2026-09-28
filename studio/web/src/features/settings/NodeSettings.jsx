import { Pencil, Trash2 } from 'lucide-react';
import Select from '../../components/ui/Select.jsx';
import Combobox from '../../components/ui/Combobox.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { NODE_META } from '../../lib/model.js';
import SettingsFields from './SettingsFields.jsx';
import { MODEL_SUGGESTIONS, opt } from './options.js';

const active = (list) => list.filter((x) => !x.shadowed);

function AgentPicker({ node, set, library, onEditComponent }) {
  const agent = active(library.agents).find((a) => a.name === node.agent);
  return (
    <>
      <Field label="Agent">
        <Select value={node.agent} placeholder="Pilih agent" onChange={(v) => set('agent', v)}
          options={active(library.agents).map((a) => opt(a.name, a.name, a.description))} />
      </Field>
      {agent && (
        <div className="component-card">
          <div className="small">{agent.file}</div>
          <div className="muted small">tools: {agent.tools.join(', ')} · {agent.model} / {agent.effort} / {agent.maxTurns} turns</div>
          <button type="button" className="btn btn-sm" onClick={() => onEditComponent('agents', agent.name)}><Pencil size={13} /> Edit Agent</button>
        </div>
      )}
    </>
  );
}

function ActionFields({ node, set, library, onEditComponent }) {
  const preset = active(library.actions).find((a) => a.name === node.action);
  return (
    <>
      <Field label="Action Tersimpan" hint="Kosong = pakai perintah di bawah">
        <Select value={node.action ?? ''} onChange={(v) => set('action', v || undefined)}
          options={[opt('', 'Perintah Custom'), ...active(library.actions).map((a) => opt(a.name, a.name, a.command))]} />
      </Field>
      <Field label="Perintah" hint={preset ? `kosong = ${preset.command}` : 'Dijalankan di folder project. Exit 0 = PASS.'}>
        <textarea className="mono" rows={3} value={node.command ?? ''} placeholder={preset?.command ?? 'npm test'} onChange={(e) => set('command', e.target.value || undefined)} />
      </Field>
      <Field label="Timeout (Menit)" hint={`kosong = ${preset?.timeout_min ?? 15}`}>
        <input type="number" min="1" value={node.timeout_min ?? ''} onChange={(e) => set('timeout_min', e.target.value === '' ? undefined : Number(e.target.value))} />
      </Field>
      {node.action && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('actions', node.action)}><Pencil size={13} /> Edit Action</button>}
    </>
  );
}

function ConditionFields({ node, set, nodes }) {
  const sources = nodes.filter((n) => n.id !== node.id && ['agent', 'skill', 'action'].includes(n.data.node.type));
  return (
    <>
      <Field label="Sumber" hint="Node yang hasilnya dinilai. Kosong = node pertama yang masuk.">
        <Select value={node.source ?? ''} onChange={(v) => set('source', v || undefined)}
          options={[opt('', 'Otomatis'), ...sources.map((n) => opt(n.id, n.data.node.label || n.id, n.data.node.agent ?? n.data.node.type))]} />
      </Field>
      <Field label="Pertanyaan" hint="Dipakai penilai LLM kalau sumber tidak punya VERDICT / exit code">
        <input value={node.check ?? ''} onChange={(e) => set('check', e.target.value || undefined)} />
      </Field>
      <Field label="Cara Menilai">
        <Select value={node.mode ?? ''} onChange={(v) => set('mode', v || undefined)} options={[
          opt('', 'Auto', 'VERDICT/exit code dulu, lalu LLM'), opt('verdict', 'Verdict Saja', 'Gagal kalau tidak ada'), opt('llm', 'Selalu LLM'),
        ]} />
      </Field>
      <Field label="Model Penilai" hint="kosong = haiku">
        <Combobox value={node.model} placeholder="haiku" suggestions={MODEL_SUGGESTIONS} onChange={(v) => set('model', v)} />
      </Field>
    </>
  );
}

function WorkFields({ node, set, ctx }) {
  const agent = active(ctx.library.agents).find((a) => a.name === node.agent);
  return (
    <>
      <Field label="Instruksi untuk Langkah Ini" hint="Hanya berlaku di workflow ini. Untuk mengubah perilaku agent di semua workflow, edit file agent-nya.">
        <textarea rows={5} value={node.instructions ?? ''} onChange={(e) => set('instructions', e.target.value || undefined)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={Boolean(node.verdict)} onChange={(e) => set('verdict', e.target.checked || undefined)} />
        Minta baris <code>VERDICT: PASS/FAIL</code> (Condition membacanya tanpa biaya LLM)
      </label>
      <SettingsFields target={node} set={set} meta={ctx.meta} agent={agent} runners={ctx.runners} />
    </>
  );
}

export default function NodeSettings({ node, update, remove, ctx, onEditComponent }) {
  const set = (key, value) => update({ ...node, [key]: value });
  const { library } = ctx;
  return (
    <>
      <p className="muted small">{NODE_META[node.type].hint}</p>
      <Field label="Label"><input value={node.label ?? ''} onChange={(e) => set('label', e.target.value || undefined)} /></Field>
      {node.type === 'start' && (
        <Field label="Input Default" hint="Dipakai kalau input saat run dikosongkan">
          <textarea rows={3} value={node.input ?? ''} onChange={(e) => set('input', e.target.value || undefined)} />
        </Field>
      )}
      {node.type === 'agent' && <AgentPicker node={node} set={set} library={library} onEditComponent={onEditComponent} />}
      {node.type === 'skill' && (
        <>
          <Field label="Skill">
            <Select value={node.skill} placeholder="Pilih skill" onChange={(v) => set('skill', v)} options={active(library.skills).map((s) => opt(s.name, s.name, s.description))} />
          </Field>
          {node.skill && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('skills', node.skill)}><Pencil size={13} /> Edit Skill</button>}
        </>
      )}
      {node.type === 'action' && <ActionFields node={node} set={set} library={library} onEditComponent={onEditComponent} />}
      {(node.type === 'agent' || node.type === 'skill') && <WorkFields node={node} set={set} ctx={ctx} />}
      {node.type === 'condition' && <ConditionFields node={node} set={set} nodes={ctx.nodes} />}
      {node.type === 'approval' && (
        <Field label="Pesan untukmu"><textarea rows={3} value={node.message ?? ''} onChange={(e) => set('message', e.target.value || undefined)} /></Field>
      )}
      {node.type === 'info' && (
        <Field label="Isi Catatan" hint="Sambungkan ke node agent supaya teks ini masuk ke prompt-nya">
          <textarea rows={8} value={node.text ?? ''} onChange={(e) => set('text', e.target.value || undefined)} />
        </Field>
      )}
      <button type="button" className="btn btn-danger" style={{ marginTop: 18 }} onClick={remove}><Trash2 size={14} /> Hapus Node</button>
    </>
  );
}
