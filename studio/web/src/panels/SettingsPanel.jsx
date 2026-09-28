import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import { TypeIcon } from '../icons.jsx';
import { NODE_META, BRANCHING, effectiveSetting } from '../model.js';

const MODELS = ['opus', 'sonnet', 'haiku'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button type="button" className="section-head" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function inheritHint(key, target, meta, agent, isDefaults) {
  if (isDefaults) return null;
  const eff = effectiveSetting(key, { ...target, [key]: undefined }, meta, agent);
  return eff.value === null || eff.value === undefined ? 'kosong = tidak dibatasi' : `kosong = ${eff.value} (dari ${eff.from})`;
}

// Pengaturan yang sama dipakai untuk node dan untuk defaults workflow.
function SettingsFields({ target, set, meta, agent, isDefaults = false, runners }) {
  const h = (key) => inheritHint(key, target, meta, agent, isDefaults);
  const num = (key) => (e) => set(key, e.target.value === '' ? undefined : Number(e.target.value));
  return (
    <>
      <Section title="Otak & model">
        <Field label="Runner" hint={h('runner') ?? 'claude-cli memakai login Claude Code; api memakai ANTHROPIC_API_KEY'}>
          <select value={target.runner ?? ''} onChange={(e) => set('runner', e.target.value || undefined)}>
            <option value="">{isDefaults ? 'claude-cli (bawaan)' : 'ikut workflow'}</option>
            <option value="claude-cli">claude-cli {runners?.['claude-cli']?.available === false ? '(tidak tersedia)' : ''}</option>
            <option value="api">api {runners?.api?.available === false ? '(API key belum di-set)' : ''}</option>
          </select>
        </Field>
        <Field label="Model" hint={h('model') ?? 'kosong = model di file agent'}>
          <input list="models" value={target.model ?? ''} placeholder="ikut agent" onChange={(e) => set('model', e.target.value || undefined)} />
          <datalist id="models">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Effort" hint={h('effort')}>
          <select value={target.effort ?? ''} onChange={(e) => set('effort', e.target.value || undefined)}>
            <option value="">ikut {isDefaults ? 'agent' : 'workflow/agent'}</option>
            {EFFORTS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      </Section>
      <Section title="Konteks & izin" defaultOpen={!isDefaults}>
        <Field label="Input dari" hint="Output node mana yang ikut dikirim. Makin sedikit makin hemat token.">
          <select value={Array.isArray(target.inputs) ? 'list' : target.inputs ?? ''} onChange={(e) => set('inputs', e.target.value || undefined)}>
            <option value="">{isDefaults ? 'previous (bawaan)' : 'ikut workflow'}</option>
            <option value="previous">previous: node yang tersambung langsung</option>
            <option value="all">all: semua node sebelumnya</option>
            <option value="none">none: hanya permintaan awal</option>
          </select>
        </Field>
        <Field label="Izin" hint="read-only membuang Edit/Write; Bash hanya git diff/log/status/show dan ls">
          <select value={target.permission ?? ''} onChange={(e) => set('permission', e.target.value || undefined)}>
            <option value="">{isDefaults ? 'sesuai tools agent' : 'ikut workflow'}</option>
            <option value="read-only">read-only</option>
          </select>
        </Field>
        <Field label="Maks karakter output yang diteruskan" hint={h('max_output_chars')}>
          <input type="number" min="1000" step="1000" value={target.max_output_chars ?? ''} onChange={num('max_output_chars')} />
        </Field>
      </Section>
      <Section title="Batas & keandalan" defaultOpen={false}>
        <Field label="Max turns" hint={h('max_turns')}>
          <input type="number" min="1" value={target.max_turns ?? ''} onChange={num('max_turns')} />
        </Field>
        <Field label="Timeout (menit)" hint={h('timeout_min')}>
          <input type="number" min="1" value={target.timeout_min ?? ''} onChange={num('timeout_min')} />
        </Field>
        <Field label="Retry kalau gagal" hint={h('retry')}>
          <input type="number" min="0" max="5" value={target.retry ?? ''} onChange={num('retry')} />
        </Field>
        <Field label="Budget per node ($)" hint={h('budget_usd')}>
          <input type="number" min="0" step="0.5" value={target.budget_usd ?? ''} onChange={num('budget_usd')} />
        </Field>
      </Section>
    </>
  );
}

function NodeSettings({ node, update, remove, ctx, onEditComponent }) {
  const { library, meta, nodes, runners } = ctx;
  const agent = library.agents.find((a) => a.name === node.agent && !a.shadowed);
  const preset = library.actions.find((a) => a.name === node.action && !a.shadowed);
  const set = (key, value) => update({ ...node, [key]: value });
  const others = nodes.filter((n) => n.id !== node.id && ['agent', 'skill', 'action'].includes(n.data.node.type));
  return (
    <>
      <p className="muted small">{NODE_META[node.type].hint}</p>
      <Field label="Label">
        <input value={node.label ?? ''} onChange={(e) => set('label', e.target.value || undefined)} />
      </Field>

      {node.type === 'start' && (
        <Field label="Input default" hint="Dipakai kalau input saat run dikosongkan">
          <textarea rows={3} value={node.input ?? ''} onChange={(e) => set('input', e.target.value || undefined)} />
        </Field>
      )}

      {node.type === 'agent' && (
        <>
          <Field label="Agent">
            <select value={node.agent ?? ''} onChange={(e) => set('agent', e.target.value)}>
              <option value="" disabled>pilih agent</option>
              {library.agents.filter((a) => !a.shadowed).map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </Field>
          {agent && (
            <div className="component-card">
              <div className="small">{agent.file}</div>
              <div className="muted small">tools: {agent.tools.join(', ')} · {agent.model} / {agent.effort} / {agent.maxTurns} turns</div>
              <button type="button" className="btn btn-sm" onClick={() => onEditComponent('agents', agent.name)}><Pencil size={13} /> Edit agent</button>
            </div>
          )}
        </>
      )}

      {node.type === 'skill' && (
        <>
          <Field label="Skill">
            <select value={node.skill ?? ''} onChange={(e) => set('skill', e.target.value)}>
              <option value="" disabled>pilih skill</option>
              {library.skills.filter((s) => !s.shadowed).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
          {node.skill && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('skills', node.skill)}><Pencil size={13} /> Edit skill</button>}
        </>
      )}

      {node.type === 'action' && (
        <>
          <Field label="Action tersimpan" hint="Kosong = pakai perintah di bawah">
            <select value={node.action ?? ''} onChange={(e) => set('action', e.target.value || undefined)}>
              <option value="">perintah custom</option>
              {library.actions.filter((a) => !a.shadowed).map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Perintah" hint={preset ? `kosong = ${preset.command}` : 'Dijalankan di folder project. Exit 0 = PASS.'}>
            <textarea className="mono" rows={3} value={node.command ?? ''} placeholder={preset?.command ?? 'npm test'} onChange={(e) => set('command', e.target.value || undefined)} />
          </Field>
          <Field label="Timeout (menit)" hint={`kosong = ${preset?.timeout_min ?? 15}`}>
            <input type="number" min="1" value={node.timeout_min ?? ''} onChange={(e) => set('timeout_min', e.target.value === '' ? undefined : Number(e.target.value))} />
          </Field>
          {node.action && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('actions', node.action)}><Pencil size={13} /> Edit action</button>}
        </>
      )}

      {(node.type === 'agent' || node.type === 'skill') && (
        <>
          <Field label="Instruksi untuk langkah ini" hint="Hanya berlaku di workflow ini. Untuk mengubah perilaku agent di semua workflow, edit file agent-nya.">
            <textarea rows={5} value={node.instructions ?? ''} onChange={(e) => set('instructions', e.target.value || undefined)} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={Boolean(node.verdict)} onChange={(e) => set('verdict', e.target.checked || undefined)} />
            Minta baris <code>VERDICT: PASS/FAIL</code> (Condition membacanya tanpa biaya LLM)
          </label>
          <SettingsFields target={node} set={set} meta={meta} agent={agent} runners={runners} />
        </>
      )}

      {node.type === 'condition' && (
        <>
          <Field label="Sumber" hint="Node yang hasilnya dinilai. Kosong = node pertama yang masuk.">
            <select value={node.source ?? ''} onChange={(e) => set('source', e.target.value || undefined)}>
              <option value="">otomatis</option>
              {others.map((n) => <option key={n.id} value={n.id}>{n.data.node.label || n.id}</option>)}
            </select>
          </Field>
          <Field label="Pertanyaan" hint="Dipakai penilai LLM kalau sumber tidak punya VERDICT / exit code">
            <input value={node.check ?? ''} onChange={(e) => set('check', e.target.value || undefined)} />
          </Field>
          <Field label="Cara menilai">
            <select value={node.mode ?? ''} onChange={(e) => set('mode', e.target.value || undefined)}>
              <option value="">auto: VERDICT/exit code dulu, lalu LLM</option>
              <option value="verdict">verdict saja (gagal kalau tidak ada)</option>
              <option value="llm">selalu LLM</option>
            </select>
          </Field>
          <Field label="Model penilai" hint="kosong = haiku">
            <input list="models" value={node.model ?? ''} onChange={(e) => set('model', e.target.value || undefined)} />
          </Field>
        </>
      )}

      {node.type === 'approval' && (
        <Field label="Pesan untukmu">
          <textarea rows={3} value={node.message ?? ''} onChange={(e) => set('message', e.target.value || undefined)} />
        </Field>
      )}

      {node.type === 'info' && (
        <Field label="Isi catatan" hint="Sambungkan ke node agent supaya teks ini masuk ke prompt-nya">
          <textarea rows={8} value={node.text ?? ''} onChange={(e) => set('text', e.target.value || undefined)} />
        </Field>
      )}

      <button type="button" className="btn btn-danger" onClick={remove}><Trash2 size={14} /> Hapus node</button>
    </>
  );
}

function EdgeSettings({ edge, sourceType, update, remove }) {
  const branching = BRANCHING.has(sourceType);
  const data = edge.data ?? {};
  return (
    <>
      {branching ? (
        <>
          <Field label="Cabang">
            <select value={String(data.when)} onChange={(e) => update({ ...data, when: e.target.value === 'true' })}>
              <option value="true">ya / PASS / disetujui</option>
              <option value="false">tidak / FAIL / ditolak</option>
            </select>
          </Field>
          <Field label="Loop (ulang maks)" hint="Isi kalau garis ini kembali ke langkah sebelumnya. Node tujuan dan turunannya diulang dengan umpan balik.">
            <input type="number" min="0" max="10" value={data.loop ?? ''} onChange={(e) => update({ ...data, loop: Number(e.target.value) || undefined })} />
          </Field>
        </>
      ) : (
        <p className="muted small">Output {edge.source} mengalir ke {edge.target}. Cabang dan loop hanya bisa dari Condition/Approval.</p>
      )}
      <button type="button" className="btn btn-danger" onClick={remove}><Trash2 size={14} /> Hapus garis</button>
    </>
  );
}

function WorkflowSettings({ meta, setMeta, runners }) {
  const set = (key, value) => setMeta({ ...meta, [key]: value });
  const setDefault = (key, value) => setMeta({ ...meta, defaults: { ...meta.defaults, [key]: value } });
  return (
    <>
      <Field label="Deskripsi">
        <textarea rows={2} value={meta.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Catatan untuk semua agent" hint="Body file .md. Ikut dikirim di setiap prompt.">
        <textarea rows={4} value={meta.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <div className="row">
        <Field label="Paralel maks">
          <input type="number" min="1" max="8" value={meta.parallel ?? 3} onChange={(e) => set('parallel', Number(e.target.value) || 3)} />
        </Field>
        <Field label="Budget run ($)" hint="Run berhenti kalau lewat">
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
    title = <>Pengaturan workflow</>;
    body = <WorkflowSettings meta={meta} setMeta={setMeta} runners={ctx.runners} />;
  }
  return (
    <aside className="rpanel">
      <div className="rpanel-head">
        <span className="rpanel-title">{title}</span>
        <button type="button" className="icon-btn" onClick={onClose} title="Tutup"><X size={16} /></button>
      </div>
      <div className="rpanel-body">{body}</div>
    </aside>
  );
}
