// Edit / buat file agent, skill, atau action. Mode Form mengubah key frontmatter satu per satu
// (key lain dan komentar tetap), mode Raw mengedit seluruh isi file.
import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Sparkles, SquareTerminal } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { api } from '../../lib/api.js';
import ComponentForm from './ComponentForm.jsx';

const TITLES = { agents: 'Agent', skills: 'Skill', actions: 'Action' };
const ICONS = { agents: Bot, skills: Sparkles, actions: SquareTerminal };
const TEMPLATES = {
  agents: 'Kamu adalah <peran>. Tugasmu <tujuan>.\n\n## Aturan kerja\n\n- \n\n## Format laporan\n\n```\nStatus: done | partial | blocked\n```\n',
  skills: '# <Nama skill>\n\nKapan dipakai, langkah kerja, dan aturan.\n',
  actions: 'Catatan: apa yang dicek perintah ini dan kapan dipakai.\n',
};

function toolsOf(meta) {
  return typeof meta.tools === 'string' ? meta.tools.split(',').map((t) => t.trim()).filter(Boolean) : meta.tools ?? [];
}

function metaPatch(kind, form) {
  if (kind === 'agents') {
    return {
      description: form.description, model: form.model, effort: form.effort, color: form.color,
      maxTurns: form.maxTurns ? Number(form.maxTurns) : null, tools: form.tools?.length ? form.tools.join(', ') : null,
    };
  }
  if (kind === 'skills') return { description: form.description, 'argument-hint': form['argument-hint'] };
  return { description: form.description, command: form.command, timeout_min: form.timeout_min ? Number(form.timeout_min) : null };
}

function ImpactNote({ item }) {
  return (
    <div className="editor-note">
      <AlertTriangle size={14} />
      <span>
        Mengubah file ini berlaku untuk <b>semua workflow</b>{item.usedBy.length ? ` (${item.usedBy.join(', ')})` : ''} dan pemakaian lewat Claude Code.
        Kalau hanya untuk satu langkah, pakai <i>Instruksi</i> dan pengaturan di node. File di <code>plugins/</code> = versi plugin: catat di CHANGELOG.
        {!item.strict && ' Frontmatter file ini bukan YAML ketat, jadi hanya bisa diedit lewat mode Raw.'}
      </span>
    </div>
  );
}

export default function ComponentEditor({ kind, name, sources, onClose, onSaved }) {
  const isNew = !name;
  const dialog = useDialog();
  const dirs = sources?.[kind] ?? [];
  const [item, setItem] = useState(null);
  const [mode, setMode] = useState('form');
  const [form, setForm] = useState({});
  const [body, setBody] = useState(TEMPLATES[kind]);
  const [raw, setRaw] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
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

  const touch = (fn) => (...args) => { setDirty(true); fn(...args); };
  const set = touch((k, v) => setForm((f) => ({ ...f, [k]: v })));

  const close = async () => {
    if (dirty && !(await dialog.confirm({
      title: 'Buang Perubahan?', message: 'Perubahan di editor ini belum disimpan dan akan hilang.', confirmLabel: 'Buang', tone: 'danger',
    }))) return;
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = isNew
        ? await api.createItem(kind, { name: target.name, dir: target.dir, area: target.area || undefined, meta: metaPatch(kind, form), body })
        : await api.updateItem(kind, name, mode === 'raw' ? { text: raw } : { meta: metaPatch(kind, form), body });
      onSaved(saved);
    } catch (err) {
      setError([err.message, ...(err.details ?? [])].join(' · '));
    } finally {
      setSaving(false);
    }
  };

  const Icon = ICONS[kind];
  return (
    <Modal
      size="xl" icon={<Icon size={18} />} onClose={close}
      title={isNew ? `${TITLES[kind]} Baru` : `Edit ${TITLES[kind]}: ${name}`}
      subtitle={item?.file ?? 'File baru'}
      headerExtra={!isNew && (
        <Segmented value={mode} onChange={(m) => { if (m === 'raw' && item) setRaw(item.text); setMode(m); }}
          options={[{ value: 'form', label: 'Form' }, { value: 'raw', label: 'Raw' }].filter((o) => o.value === 'raw' || item?.strict !== false)} />
      )}
      footer={(
        <>
          {error && <span className="err small">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={close}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={saving || (isNew && !target.name)} onClick={save}>
            {saving ? 'Menyimpan…' : isNew ? 'Buat' : 'Simpan'}
          </button>
        </>
      )}
    >
      {!isNew && item && <ImpactNote item={item} />}
      {mode === 'raw'
        ? <textarea className="mono editor-raw" value={raw} onChange={(e) => touch(setRaw)(e.target.value)} spellCheck={false} aria-label="Isi file" />
        : <ComponentForm kind={kind} isNew={isNew} form={form} set={set} target={target} setTarget={setTarget} dirs={dirs} body={body} setBody={touch(setBody)} />}
    </Modal>
  );
}
