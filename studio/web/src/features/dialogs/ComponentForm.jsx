// The component editor form fields per kind (agent / skill / action).
import Select from '../../components/ui/Select.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { AGENT_COLORS } from '../../lib/model.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'Skill', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Agent'];
const MODEL_NAMES = ['opus', 'sonnet', 'haiku'];
const EFFORT_NAMES = ['low', 'medium', 'high', 'xhigh', 'max'];
const KIND_BODY_LABEL = { agents: 'dialogs.component.body-agents', skills: 'dialogs.component.body-skills', actions: 'dialogs.component.body-actions' };

function AgentFields({ form, set }) {
  const { t } = useI18n();
  const tools = form.tools ?? [];
  const modelOptions = [{ value: '', label: t('dialogs.component.model-inherit') }, ...MODEL_NAMES.map((m) => ({ value: m, label: m }))];
  const effortOptions = [{ value: '', label: t('dialogs.component.effort-default') }, ...EFFORT_NAMES.map((m) => ({ value: m, label: m }))];
  return (
    <>
      <div className="row">
        <Field label={t('dialogs.component.field.model')}><Select value={form.model ?? ''} options={modelOptions} onChange={(v) => set('model', v || null)} /></Field>
        <Field label={t('dialogs.component.field.effort')}><Select value={form.effort ?? ''} options={effortOptions} onChange={(v) => set('effort', v || null)} /></Field>
      </div>
      <Field label={t('dialogs.component.field.max-turns')}>
        <input type="number" min="1" value={form.maxTurns ?? ''} onChange={(e) => set('maxTurns', e.target.value)} />
      </Field>
      <Field label={t('dialogs.component.field.color')}>
        <div className="swatches">
          {Object.entries(AGENT_COLORS).map(([c, hex]) => (
            <button type="button" key={c} title={c} aria-label={t('dialogs.component.color-aria', { color: c })} className={`swatch ${form.color === c ? 'active' : ''}`} style={{ background: hex }} onClick={() => set('color', c)} />
          ))}
        </div>
      </Field>
      <Field label={t('dialogs.component.field.tools')} hint={t('dialogs.component.hint.tools')}>
        <div className="tool-grid">
          {TOOLS.map((tool) => (
            <label key={tool} className="check">
              <input type="checkbox" checked={tools.includes(tool)} onChange={(e) => set('tools', e.target.checked ? [...tools, tool] : tools.filter((x) => x !== tool))} />
              {tool}
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}

function NewTarget({ kind, target, setTarget, dirs }) {
  const { t } = useI18n();
  return (
    <>
      <Field label={t('dialogs.component.field.name')} hint={t('dialogs.component.hint.name')}>
        <input autoFocus value={target.name} onChange={(e) => setTarget({ ...target, name: e.target.value.trim() })} />
      </Field>
      <Field label={t('dialogs.component.field.folder')}>
        <Select value={target.dir} onChange={(dir) => setTarget({ ...target, dir })}
          options={dirs.map((d) => ({ value: d.path, label: d.entry, description: d.exists ? d.path : t('dialogs.component.folder-will-be-created') }))} />
      </Field>
      {kind === 'skills' && (
        <Field label={t('dialogs.component.field.area')} hint={t('dialogs.component.hint.area')}>
          <input value={target.area} onChange={(e) => setTarget({ ...target, area: e.target.value.trim() })} />
        </Field>
      )}
    </>
  );
}

export default function ComponentForm({ kind, isNew, form, set, target, setTarget, dirs, body, setBody }) {
  const { t } = useI18n();
  const bodyLabel = t(KIND_BODY_LABEL[kind]);
  return (
    <div className="editor-grid">
      <div className="editor-fields">
        {isNew && <NewTarget kind={kind} target={target} setTarget={setTarget} dirs={dirs} />}
        <Field label={t('dialogs.component.field.description')} hint={kind === 'actions' ? null : t('dialogs.component.hint.description')}>
          <textarea rows={kind === 'actions' ? 2 : 5} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {kind === 'agents' && <AgentFields form={form} set={set} />}
        {kind === 'skills' && (
          <Field label={t('dialogs.component.field.argument-hint')} hint={t('dialogs.component.hint.argument-hint')}>
            <input value={form['argument-hint'] ?? ''} onChange={(e) => set('argument-hint', e.target.value)} />
          </Field>
        )}
        {kind === 'actions' && (
          <>
            <Field label={t('dialogs.component.field.command')} hint={t('dialogs.component.hint.command')}>
              <textarea className="mono" rows={3} value={form.command ?? ''} onChange={(e) => set('command', e.target.value)} />
            </Field>
            <Field label={t('dialogs.component.field.timeout')}>
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
