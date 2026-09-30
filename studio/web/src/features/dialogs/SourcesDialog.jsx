// The folders the studio reads. Folders are added through the file-manager-style picker; they are displayed in short form.
import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, FolderCog, FolderPlus, Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import FolderPicker from './FolderPicker.jsx';

const KINDS = [
  ['agents', 'dialogs.sources.kind.agents', ['plugins/agents', '{workdir}/.claude/agents', '~/.claude/agents']],
  ['skills', 'dialogs.sources.kind.skills', ['plugins/skills', '{workdir}/.claude/skills', '~/.claude/skills']],
  ['actions', 'dialogs.sources.kind.actions', ['plugins/actions', '{workdir}/.claude/actions']],
  ['workflows', 'dialogs.sources.kind.workflows', ['plugins/workflows', '{workdir}/.claude/workflows']],
];

function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function SourceGroup({ kind, label, suggestions, entries, info, onChange, onBrowse }) {
  const { t } = useI18n();
  return (
    <div className="source-group">
      <div className="subhead">{label}</div>
      {entries.map((entry, i) => {
        const it = info(kind, entry);
        return (
          <div key={entry} className="source-row">
            {it?.exists !== false ? <CheckCircle2 size={14} className="ok" /> : <CircleDashed size={14} className="muted" />}
            <span className="entry" title={it?.path ?? entry}>{entry}</span>
            {i === 0 && <span className="tag">{t('dialogs.sources.new-files-here')}</span>}
            <button type="button" className="icon-btn" title={t('dialogs.sources.move-up')} aria-label={t('dialogs.sources.move-up')} onClick={() => onChange(move(entries, i, i - 1))}><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" title={t('dialogs.sources.move-down')} aria-label={t('dialogs.sources.move-down')} onClick={() => onChange(move(entries, i, i + 1))}><ArrowDown size={14} /></button>
            <button type="button" className="icon-btn" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => onChange(entries.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        );
      })}
      <div className="source-add">
        <button type="button" className="chip-btn solid" onClick={onBrowse}><FolderPlus size={12} /> {t('dialogs.sources.pick-folder')}</button>
        {suggestions.filter((s) => !entries.includes(s)).map((s) => (
          <button type="button" key={s} className="chip-btn" onClick={() => onChange([...entries, s])}><Plus size={12} /> {s}</button>
        ))}
      </div>
    </div>
  );
}

export default function SourcesDialog({ sources, onClose, onSave }) {
  const { t } = useI18n();
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
        size="lg" title={t('sidebar.sources.label')} icon={<FolderCog size={18} />} onClose={onClose}
        subtitle={t('dialogs.sources.subtitle')}
        footer={(
          <>
            <span className="muted small">{t('dialogs.sources.legend')}</span>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{t('common.save')}</button>
          </>
        )}
      >
        <div className="sources">
          {KINDS.map(([kind, label, suggestions]) => (
            <SourceGroup key={kind} kind={kind} label={t(label)} suggestions={suggestions} entries={draft[kind]} info={info}
              onChange={(list) => update(kind, list)} onBrowse={() => setBrowsing(kind)} />
          ))}
        </div>
      </Modal>
      {browsing && (
        <FolderPicker
          title={t('dialogs.sources.add-title', { kind: t(KINDS.find(([k]) => k === browsing)[1]) })}
          confirmLabel={t('dialogs.sources.add')}
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
