import { Pencil, Trash2 } from 'lucide-react';
import Select from '../../components/ui/Select.jsx';
import Combobox from '../../components/ui/Combobox.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { nodeTypeHint } from '../../lib/model.js';
import SettingsFields from './SettingsFields.jsx';
import { modelSuggestions, opt } from './options.js';

const active = (list) => list.filter((x) => !x.shadowed);

function AgentPicker({ node, set, library, onEditComponent }) {
  const { t } = useI18n();
  const agent = active(library.agents).find((a) => a.name === node.agent);
  return (
    <>
      <Field label={t('settings.field.agent')}>
        <Select value={node.agent} placeholder={t('settings.placeholder.choose-agent')} onChange={(v) => set('agent', v)}
          options={active(library.agents).map((a) => opt(a.name, a.name, a.description))} />
      </Field>
      {agent && (
        <div className="component-card">
          <div className="small">{agent.file}</div>
          <div className="muted small">{t('settings.agent.card', { tools: agent.tools.join(', '), model: agent.model, effort: agent.effort, turns: agent.maxTurns })}</div>
          <button type="button" className="btn btn-sm" onClick={() => onEditComponent('agents', agent.name)}><Pencil size={13} /> {t('settings.edit-agent')}</button>
        </div>
      )}
    </>
  );
}

function ActionFields({ node, set, library, onEditComponent }) {
  const { t } = useI18n();
  const preset = active(library.actions).find((a) => a.name === node.action);
  return (
    <>
      <Field label={t('settings.field.saved-action')} hint={t('settings.hint.saved-action')}>
        <Select value={node.action ?? ''} onChange={(v) => set('action', v || undefined)}
          options={[opt('', t('settings.action.custom')), ...active(library.actions).map((a) => opt(a.name, a.name, a.command))]} />
      </Field>
      <Field label={t('settings.field.command')} hint={preset ? t('settings.hint.empty-equals', { value: preset.command }) : t('settings.hint.command')}>
        <textarea className="mono" rows={3} value={node.command ?? ''} placeholder={preset?.command ?? 'npm test'} onChange={(e) => set('command', e.target.value || undefined)} />
      </Field>
      <Field label={t('settings.field.timeout')} hint={t('settings.hint.empty-equals', { value: preset?.timeout_min ?? 15 })}>
        <input type="number" min="1" value={node.timeout_min ?? ''} onChange={(e) => set('timeout_min', e.target.value === '' ? undefined : Number(e.target.value))} />
      </Field>
      {node.action && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('actions', node.action)}><Pencil size={13} /> {t('settings.edit-action')}</button>}
    </>
  );
}

function ConditionFields({ node, set, nodes }) {
  const { t } = useI18n();
  const sources = nodes.filter((n) => n.id !== node.id && ['agent', 'skill', 'action'].includes(n.data.node.type));
  return (
    <>
      <Field label={t('settings.field.source')} hint={t('settings.hint.source')}>
        <Select value={node.source ?? ''} onChange={(v) => set('source', v || undefined)}
          options={[opt('', t('settings.source.auto')), ...sources.map((n) => opt(n.id, n.data.node.label || n.id, n.data.node.agent ?? n.data.node.type))]} />
      </Field>
      <Field label={t('settings.field.question')} hint={t('settings.hint.question')}>
        <input value={node.check ?? ''} onChange={(e) => set('check', e.target.value || undefined)} />
      </Field>
      <Field label={t('settings.field.judge-mode')}>
        <Select value={node.mode ?? ''} onChange={(v) => set('mode', v || undefined)} options={[
          opt('', t('settings.judge.auto'), t('settings.judge.auto-desc')), opt('verdict', t('settings.judge.verdict'), t('settings.judge.verdict-desc')), opt('llm', t('settings.judge.llm')),
        ]} />
      </Field>
      <Field label={t('settings.field.judge-model')} hint={t('settings.hint.judge-model')}>
        <Combobox value={node.model} placeholder={'haiku'} suggestions={modelSuggestions(t)} onChange={(v) => set('model', v)} />
      </Field>
    </>
  );
}

function WorkFields({ node, set, ctx }) {
  const { t } = useI18n();
  const agent = active(ctx.library.agents).find((a) => a.name === node.agent);
  return (
    <>
      <Field label={t('settings.field.instructions')} hint={t('settings.hint.instructions')}>
        <textarea rows={5} value={node.instructions ?? ''} onChange={(e) => set('instructions', e.target.value || undefined)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={Boolean(node.verdict)} onChange={(e) => set('verdict', e.target.checked || undefined)} />
        {t('settings.verdict-checkbox')}
      </label>
      <SettingsFields target={node} set={set} meta={ctx.meta} agent={agent} runners={ctx.runners} />
    </>
  );
}

export default function NodeSettings({ node, update, remove, ctx, onEditComponent }) {
  const { t } = useI18n();
  const set = (key, value) => update({ ...node, [key]: value });
  const { library } = ctx;
  return (
    <>
      <p className="muted small">{nodeTypeHint(t, node.type)}</p>
      <Field label={t('settings.field.label')}><input value={node.label ?? ''} onChange={(e) => set('label', e.target.value || undefined)} /></Field>
      {node.type === 'start' && (
        <Field label={t('settings.field.default-input')} hint={t('settings.hint.default-input')}>
          <textarea rows={3} value={node.input ?? ''} onChange={(e) => set('input', e.target.value || undefined)} />
        </Field>
      )}
      {node.type === 'agent' && <AgentPicker node={node} set={set} library={library} onEditComponent={onEditComponent} />}
      {node.type === 'skill' && (
        <>
          <Field label={t('settings.field.skill')}>
            <Select value={node.skill} placeholder={t('settings.placeholder.choose-skill')} onChange={(v) => set('skill', v)} options={active(library.skills).map((s) => opt(s.name, s.name, s.description))} />
          </Field>
          {node.skill && <button type="button" className="btn btn-sm" onClick={() => onEditComponent('skills', node.skill)}><Pencil size={13} /> {t('settings.edit-skill')}</button>}
        </>
      )}
      {node.type === 'action' && <ActionFields node={node} set={set} library={library} onEditComponent={onEditComponent} />}
      {(node.type === 'agent' || node.type === 'skill') && <WorkFields node={node} set={set} ctx={ctx} />}
      {node.type === 'condition' && <ConditionFields node={node} set={set} nodes={ctx.nodes} />}
      {node.type === 'approval' && (
        <Field label={t('settings.field.approval-message')}><textarea rows={3} value={node.message ?? ''} onChange={(e) => set('message', e.target.value || undefined)} /></Field>
      )}
      {node.type === 'info' && (
        <Field label={t('settings.field.note-text')} hint={t('settings.hint.note-text')}>
          <textarea rows={8} value={node.text ?? ''} onChange={(e) => set('text', e.target.value || undefined)} />
        </Field>
      )}
      <button type="button" className="btn btn-danger" style={{ marginTop: 18 }} onClick={remove}><Trash2 size={14} /> {t('settings.delete-node')}</button>
    </>
  );
}
