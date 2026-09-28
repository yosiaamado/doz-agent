// Edit / buat file agent, skill, atau action. Mode Form mengubah key frontmatter satu per satu
// (key lain dan komentar tetap), mode Raw mengedit seluruh isi file.
import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { AGENT_COLORS } from '../model.js';
import { Field } from '../panels/SettingsPanel.jsx';

const TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Agent'];
const TITLES = { agents: 'agent', skills: 'skill', actions: 'action' };
const TEMPLATES = {
  agents: 'Kamu adalah <peran>. Tugasmu <tujuan>.\n\n## Aturan kerja\n\n- \n\n## Format laporan\n\n```\nStatus: done | partial | blocked\n```\n',
  skills: '# <Nama skill>\n\nKapan dipakai, langkah kerja, dan aturan.\n',
  actions: 'Catatan: apa yang dicek perintah ini dan kapan dipakai.\n',
};

function toolsOf(meta) {
  return typeof meta.tools === 'string' ? meta.tools.split(',').map((t) => t.trim()).filter(Boolean) : meta.tools ?? [];
}

export default function ComponentEditor({ kind, name, sources, onClose, onSaved }) {
  const isNew = !name;
  const [item, setItem] = useState(null);
  const [mode, setMode] = useState('form');
  const [form, setForm] = useState({});
  const [body, setBody] = useState(TEMPLATES[kind]);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirs = sources?.[kind] ?? [];
  const [target, setTarget] = useState({ name: '', dir: dirs.find((d) => d.exists)?.path ?? dirs[0]?.path ?? '', area: '' });

  useEffect(() => {
    if (isNew) return;
    api.item(kind, name).then((it) => {
      setItem(it);
      setForm({ ...it.meta, tools: toolsOf(it.meta) });
      setBody(it.body);
      setRaw(it.text);
      if (!it.strict) setMode('raw');
    }).catch((err) => setError(err.message));
  }, [kind, name, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const metaPatch = () => {
    if (kind === 'agents') {
      return {
        description: form.description, model: form.model, effort: form.effort,
        maxTurns: form.maxTurns ? Number(form.maxTurns) : null, color: form.color,
        tools: form.tools?.length ? form.tools.join(', ') : null,
      };
    }
    if (kind === 'skills') return { description: form.description, 'argument-hint': form['argument-hint'] };
    return { description: form.description, command: form.command, timeout_min: form.timeout_min ? Number(form.timeout_min) : null };
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = isNew
        ? await api.createItem(kind, { name: target.name, dir: target.dir, area: target.area || undefined, meta: metaPatch(), body })
        : await api.updateItem(kind, name, mode === 'raw' ? { text: raw } : { meta: metaPatch(), body });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const switchMode = (m) => {
    if (m === 'raw' && !isNew && item) {
      // Raw memakai isi file terakhir yang tersimpan; perubahan form yang belum disimpan tidak ikut.
      setRaw(item.text);
    }
    setMode(m);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <div>
            <div className="editor-title">{isNew ? `${TITLES[kind][0].toUpperCase()}${TITLES[kind].slice(1)} baru` : `Edit ${TITLES[kind]}: ${name}`}</div>
            <div className="muted small">{item?.file ?? 'File baru'}</div>
          </div>
          <div className="seg">
            <button type="button" className={mode === 'form' ? 'active' : ''} disabled={item && !item.strict} onClick={() => switchMode('form')}>Form</button>
            {!isNew && <button type="button" className={mode === 'raw' ? 'active' : ''} onClick={() => switchMode('raw')}>Raw</button>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {!isNew && item && (
          <div className="editor-note">
            <AlertTriangle size={14} />
            <span>
              Mengubah file ini berlaku untuk <b>semua workflow</b>{item.usedBy.length ? ` (${item.usedBy.join(', ')})` : ''} dan pemakaian lewat Claude Code.
              Kalau hanya untuk satu langkah, pakai <i>Instruksi</i> dan pengaturan di node. File di <code>plugins/</code> = versi plugin: catat di CHANGELOG.
              {!item.strict && ' Frontmatter file ini bukan YAML ketat, jadi hanya bisa diedit lewat mode Raw.'}
            </span>
          </div>
        )}

        <div className="editor-body">
          {mode === 'raw' ? (
            <textarea className="mono editor-raw" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} />
          ) : (
            <div className="editor-grid">
              <div className="editor-fields">
                {isNew && (
                  <>
                    <Field label="Nama" hint="huruf kecil, angka, - (jadi nama file)">
                      <input value={target.name} onChange={(e) => setTarget({ ...target, name: e.target.value.trim() })} autoFocus />
                    </Field>
                    <Field label="Simpan di folder">
                      <select value={target.dir} onChange={(e) => setTarget({ ...target, dir: e.target.value })}>
                        {dirs.map((d) => <option key={d.path} value={d.path}>{d.entry}{d.exists ? '' : ' (dibuat)'}</option>)}
                      </select>
                    </Field>
                    {kind === 'skills' && (
                      <Field label="Bidang (subfolder, opsional)" hint="mis. engineering, product">
                        <input value={target.area} onChange={(e) => setTarget({ ...target, area: e.target.value.trim() })} />
                      </Field>
                    )}
                  </>
                )}
                <Field label="Deskripsi" hint={kind === 'actions' ? null : 'Claude Code memakai ini untuk memutuskan kapan komponen dipanggil'}>
                  <textarea rows={kind === 'actions' ? 2 : 5} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
                </Field>
                {kind === 'agents' && (
                  <>
                    <div className="row">
                      <Field label="Model">
                        <select value={form.model ?? ''} onChange={(e) => set('model', e.target.value || null)}>
                          <option value="">inherit</option>
                          {['opus', 'sonnet', 'haiku'].map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="Effort">
                        <select value={form.effort ?? ''} onChange={(e) => set('effort', e.target.value || null)}>
                          <option value="">bawaan</option>
                          {['low', 'medium', 'high', 'xhigh', 'max'].map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Max turns">
                      <input type="number" min="1" value={form.maxTurns ?? ''} onChange={(e) => set('maxTurns', e.target.value)} />
                    </Field>
                    <Field label="Warna">
                      <div className="swatches">
                        {Object.entries(AGENT_COLORS).map(([c, hex]) => (
                          <button type="button" key={c} title={c} className={`swatch ${form.color === c ? 'active' : ''}`} style={{ background: hex }} onClick={() => set('color', c)} />
                        ))}
                      </div>
                    </Field>
                    <Field label="Tools" hint="Edit/Write = agent bisa mengubah file">
                      <div className="tool-grid">
                        {TOOLS.map((t) => (
                          <label key={t} className="check">
                            <input type="checkbox" checked={form.tools?.includes(t) ?? false}
                              onChange={(e) => set('tools', e.target.checked ? [...(form.tools ?? []), t] : (form.tools ?? []).filter((x) => x !== t))} />
                            {t}
                          </label>
                        ))}
                      </div>
                    </Field>
                  </>
                )}
                {kind === 'skills' && (
                  <Field label="Argument hint" hint='mis. "<deskripsi fitur>"'>
                    <input value={form['argument-hint'] ?? ''} onChange={(e) => set('argument-hint', e.target.value)} />
                  </Field>
                )}
                {kind === 'actions' && (
                  <>
                    <Field label="Perintah" hint="Dijalankan di folder project. Exit 0 = PASS.">
                      <textarea className="mono" rows={3} value={form.command ?? ''} onChange={(e) => set('command', e.target.value)} />
                    </Field>
                    <Field label="Timeout (menit)">
                      <input type="number" min="1" value={form.timeout_min ?? ''} onChange={(e) => set('timeout_min', e.target.value)} />
                    </Field>
                  </>
                )}
              </div>
              <Field label={kind === 'agents' ? 'System prompt (isi agent)' : kind === 'skills' ? 'Isi SKILL.md' : 'Catatan'}>
                <textarea className="mono editor-prompt" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
              </Field>
            </div>
          )}
        </div>

        <div className="editor-foot">
          {error && <span className="err">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={saving || (isNew && !target.name)} onClick={save}>
            {saving ? 'Menyimpan…' : isNew ? 'Buat' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
