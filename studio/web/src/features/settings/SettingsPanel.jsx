import { Trash2, X } from 'lucide-react';
import Select from '../../components/ui/Select.jsx';
import { Field, Section } from '../../components/ui/Field.jsx';
import { TypeIcon } from '../../components/icons.jsx';
import { LOCALES, LOCALE_LABELS } from '../../i18n/index.js';
import UpdateSettings from '../update/UpdateSettings.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { BRANCHING, nodeTypeLabel } from '../../lib/model.js';
import NodeSettings from './NodeSettings.jsx';
import SettingsFields from './SettingsFields.jsx';
import { opt } from './options.js';

function EdgeSettings({ edge, sourceType, update, remove }) {
  const { t } = useI18n();
  const data = edge.data ?? {};
  return (
    <>
      {BRANCHING.has(sourceType) ? (
        <>
          <Field label={t('settings.field.branch')}>
            <Select value={String(data.when)} onChange={(v) => update({ ...data, when: v === 'true' })}
              options={[opt('true', t('settings.branch.yes'), t('settings.branch.yes-desc')), opt('false', t('settings.branch.no'), t('settings.branch.no-desc'))]} />
          </Field>
          <Field label={t('settings.field.loop')} hint={t('settings.hint.loop')}>
            <input type="number" min="0" max="10" value={data.loop ?? ''} onChange={(e) => update({ ...data, loop: Number(e.target.value) || undefined })} />
          </Field>
        </>
      ) : <p className="muted small">{t('settings.edge.plain', { source: edge.source, target: edge.target })}</p>}
      <button type="button" className="btn btn-danger" style={{ marginTop: 18 }} onClick={remove}><Trash2 size={14} /> {t('settings.delete-edge')}</button>
    </>
  );
}

// The interface language: stored in this browser, applies to the whole studio.
function LanguageField() {
  const { t, locale, setLocale } = useI18n();
  return (
    <Section title={t('settings.section.interface')}>
      <Field label={t('settings.field.language')} hint={t('settings.hint.language')}>
        <Select value={locale} onChange={setLocale} options={LOCALES.map((l) => opt(l, LOCALE_LABELS[l]))} />
      </Field>
    </Section>
  );
}

function WorkflowSettings({ meta, setMeta, runners }) {
  const { t } = useI18n();
  const set = (key, value) => setMeta({ ...meta, [key]: value });
  const setDefault = (key, value) => setMeta({ ...meta, defaults: { ...meta.defaults, [key]: value } });
  return (
    <>
      <LanguageField />
      <UpdateSettings />
      <Field label={t('settings.field.description')}><textarea rows={2} value={meta.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
      <Field label={t('settings.field.notes')} hint={t('settings.hint.notes')}>
        <textarea rows={4} value={meta.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <div className="row">
        <Field label={t('settings.field.parallel')}><input type="number" min="1" max="8" value={meta.parallel ?? 3} onChange={(e) => set('parallel', Number(e.target.value) || 3)} /></Field>
        <Field label={t('settings.field.run-budget')} hint={t('settings.hint.run-budget')}>
          <input type="number" min="0" step="1" value={meta.budget_usd ?? ''} onChange={(e) => set('budget_usd', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      </div>
      <p className="muted small">{t('settings.hint.defaults')}</p>
      <SettingsFields target={meta.defaults ?? {}} set={setDefault} meta={meta} isDefaults runners={runners} />
    </>
  );
}

export default function SettingsPanel({ selection, ctx, onNodeChange, onEdgeChange, onDelete, meta, setMeta, onClose, onEditComponent }) {
  const { t } = useI18n();
  let title;
  let body;
  if (selection?.kind === 'node') {
    const n = selection.node;
    title = <><TypeIcon type={n.type} size={16} /> {n.label || nodeTypeLabel(t, n.type)} <span className="muted small">#{n.id}</span></>;
    body = <NodeSettings node={n} ctx={ctx} update={onNodeChange} remove={onDelete} onEditComponent={onEditComponent} />;
  } else if (selection?.kind === 'edge') {
    title = <>{t('settings.edge.title', { source: selection.edge.source, target: selection.edge.target })}</>;
    body = <EdgeSettings edge={selection.edge} sourceType={selection.sourceType} update={onEdgeChange} remove={onDelete} />;
  } else {
    title = <>{t('settings.workflow.title')}</>;
    body = <WorkflowSettings meta={meta} setMeta={setMeta} runners={ctx.runners} />;
  }
  return (
    <aside className="rpanel" aria-label={t('settings.aria')}>
      <div className="rpanel-head">
        <span className="rpanel-title">{title}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
      </div>
      <div className="rpanel-body">{body}</div>
    </aside>
  );
}
