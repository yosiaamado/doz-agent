// Edit / create an agent, skill, or action file. Form mode changes frontmatter keys one at a time
// (leaving the other keys and comments intact), Raw mode edits the whole file.
import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Sparkles, SquareTerminal } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { api } from '../../lib/api.js';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import ComponentForm from './ComponentForm.jsx';

const KIND_LABEL = { agents: 'dialogs.component.kind.agents', skills: 'dialogs.component.kind.skills', actions: 'dialogs.component.kind.actions' };
const ICONS = { agents: Bot, skills: Sparkles, actions: SquareTerminal };
const TEMPLATES = {
  agents: 'You are <role>. Your job is <goal>.\n\n## Working rules\n\n- \n\n## Report format\n\n```\nStatus: done | partial | blocked\n```\n',
  skills: '# <Skill name>\n\nWhen to use it, the steps, and the rules.\n',
  actions: 'Note: what this command checks and when to use it.\n',
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
  const { t } = useI18n();
  return (
    <div className="editor-note">
      <AlertTriangle size={14} />
      <span>
        {t('dialogs.component.impact', { usedBy: item.usedBy.length ? ` (${item.usedBy.join(', ')})` : '' })}
        {!item.strict && ` ${t('dialogs.component.not-strict')}`}
      </span>
    </div>
  );
}

export default function ComponentEditor({ kind, name, sources, onClose, onSaved }) {
  const isNew = !name;
  const { t } = useI18n();
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
    }).catch((err) => setError(errorMessage(t, err)));
    // Load once per component; switching language must not reset a form that is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, name, isNew]);

  const touch = (fn) => (...args) => { setDirty(true); fn(...args); };
  const set = touch((k, v) => setForm((f) => ({ ...f, [k]: v })));

  const close = async () => {
    if (dirty && !(await dialog.confirm({
      title: t('dialogs.discard.title'), message: t('dialogs.discard.editor'), confirmLabel: t('dialogs.discard.confirm'), tone: 'danger',
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
      setError(errorWithDetails(t, err, ' · '));
    } finally {
      setSaving(false);
    }
  };

  const Icon = ICONS[kind];
  return (
    <Modal
      size="xl" icon={<Icon size={18} />} onClose={close}
      title={isNew ? t('dialogs.component.title-new', { kind: t(KIND_LABEL[kind]) }) : t('dialogs.component.title-edit', { kind: t(KIND_LABEL[kind]), name })}
      subtitle={item?.file ?? t('dialogs.component.new-file')}
      headerExtra={!isNew && (
        <Segmented value={mode} onChange={(m) => { if (m === 'raw' && item) setRaw(item.text); setMode(m); }}
          options={[{ value: 'form', label: t('dialogs.component.mode-form') }, { value: 'raw', label: t('dialogs.component.mode-raw') }].filter((o) => o.value === 'raw' || item?.strict !== false)} />
      )}
      footer={(
        <>
          {error && <span className="err small">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={close}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={saving || (isNew && !target.name)} onClick={save}>
            {saving ? t('common.saving') : isNew ? t('dialogs.component.create') : t('common.save')}
          </button>
        </>
      )}
    >
      {!isNew && item && <ImpactNote item={item} />}
      {mode === 'raw'
        ? <textarea className="mono editor-raw" value={raw} onChange={(e) => touch(setRaw)(e.target.value)} spellCheck={false} aria-label={t('dialogs.component.file-content')} />
        : <ComponentForm kind={kind} isNew={isNew} form={form} set={set} target={target} setTarget={setTarget} dirs={dirs} body={body} setBody={touch(setBody)} />}
    </Modal>
  );
}
