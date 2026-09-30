// Pengaturan eksekusi yang sama untuk node agent/skill dan untuk default workflow.
import Select from '../../components/ui/Select.jsx';
import Combobox from '../../components/ui/Combobox.jsx';
import { Field, Section } from '../../components/ui/Field.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { effectiveSetting } from '../../lib/model.js';
import { EFFORTS, modelSuggestions, opt } from './options.js';

const SOURCE_LABEL = {
  node: 'settings.source.node',
  workflow: 'settings.source.workflow',
  agent: 'settings.source.agent',
  builtin: 'settings.source.builtin',
};

function inheritHint(t, key, target, meta, agent, isDefaults) {
  if (isDefaults) return null;
  const eff = effectiveSetting(key, { ...target, [key]: undefined }, meta, agent);
  if (eff.value === null || eff.value === undefined) return t('settings.hint.unlimited');
  return t('settings.hint.inherited', { value: eff.value, from: t(SOURCE_LABEL[eff.from]) });
}

function NumberField({ label, hint, value, onChange, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} {...rest} />
    </Field>
  );
}

export default function SettingsFields({ target, set, meta, agent, isDefaults = false, runners }) {
  const { t } = useI18n();
  const h = (key) => inheritHint(t, key, target, meta, agent, isDefaults);
  const inherit = isDefaults ? null : opt('', t('settings.inherit-workflow'));
  const runnerOptions = [
    isDefaults ? opt('', t('settings.runner.claude-cli-default')) : inherit,
    opt('claude-cli', 'claude-cli', runners?.['claude-cli']?.available === false ? t('settings.runner.unavailable') : t('settings.runner.claude-login')),
    opt('api', 'api', runners?.api?.available === false ? t('settings.runner.api-key-missing') : t('settings.runner.api-key')),
  ];
  return (
    <>
      <Section title={t('settings.section.brain')}>
        <Field label={t('settings.field.runner')} hint={h('runner')}>
          <Select value={target.runner ?? ''} options={runnerOptions} onChange={(v) => set('runner', v || undefined)} />
        </Field>
        <Field label={t('settings.field.model')} hint={h('model') ?? t('settings.hint.model-agent')}>
          <Combobox value={target.model} placeholder={t('settings.placeholder.follow-agent')} suggestions={modelSuggestions(t)} onChange={(v) => set('model', v)} />
        </Field>
        <Field label={t('settings.field.effort')} hint={h('effort')}>
          <Select value={target.effort ?? ''} onChange={(v) => set('effort', v || undefined)}
            options={[opt('', isDefaults ? t('settings.effort.follow-agent') : t('settings.effort.follow-workflow-agent')), ...EFFORTS.map((e) => opt(e, e))]} />
        </Field>
      </Section>
      <Section title={t('settings.section.context')} defaultOpen={!isDefaults}>
        <Field label={t('settings.field.inputs')} hint={t('settings.hint.inputs')}>
          <Select value={Array.isArray(target.inputs) ? '' : target.inputs ?? ''} onChange={(v) => set('inputs', v || undefined)} options={[
            isDefaults ? opt('', t('settings.inputs.previous-default')) : inherit,
            opt('previous', 'previous', t('settings.inputs.previous')),
            opt('all', 'all', t('settings.inputs.all')),
            opt('none', 'none', t('settings.inputs.none')),
          ]} />
        </Field>
        <Field label={t('settings.field.permission')} hint={t('settings.hint.permission')}>
          <Select value={target.permission ?? ''} onChange={(v) => set('permission', v || undefined)}
            options={[isDefaults ? opt('', t('settings.permission.follow-agent')) : inherit, opt('read-only', 'read-only', t('settings.permission.read-only'))]} />
        </Field>
        <NumberField label={t('settings.field.max-output')} hint={h('max_output_chars')} min="1000" step="1000" value={target.max_output_chars} onChange={(v) => set('max_output_chars', v)} />
      </Section>
      <Section title={t('settings.section.limits')} defaultOpen={false}>
        <NumberField label={t('settings.field.max-turns')} hint={h('max_turns')} min="1" value={target.max_turns} onChange={(v) => set('max_turns', v)} />
        <NumberField label={t('settings.field.timeout')} hint={h('timeout_min')} min="1" value={target.timeout_min} onChange={(v) => set('timeout_min', v)} />
        <NumberField label={t('settings.field.retry')} hint={h('retry')} min="0" max="5" value={target.retry} onChange={(v) => set('retry', v)} />
        <NumberField label={t('settings.field.budget-node')} hint={h('budget_usd')} min="0" step="0.5" value={target.budget_usd} onChange={(v) => set('budget_usd', v)} />
      </Section>
    </>
  );
}
