// Pengaturan eksekusi yang sama untuk node agent/skill dan untuk default workflow.
import Select from '../../components/ui/Select.jsx';
import Combobox from '../../components/ui/Combobox.jsx';
import { Field, Section } from '../../components/ui/Field.jsx';
import { effectiveSetting } from '../../lib/model.js';
import { EFFORTS, MODEL_SUGGESTIONS, opt } from './options.js';

function inheritHint(key, target, meta, agent, isDefaults) {
  if (isDefaults) return null;
  const eff = effectiveSetting(key, { ...target, [key]: undefined }, meta, agent);
  return eff.value === null || eff.value === undefined ? 'kosong = tidak dibatasi' : `kosong = ${eff.value} (dari ${eff.from})`;
}

function NumberField({ label, hint, value, onChange, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} {...rest} />
    </Field>
  );
}

export default function SettingsFields({ target, set, meta, agent, isDefaults = false, runners }) {
  const h = (key) => inheritHint(key, target, meta, agent, isDefaults);
  const inherit = isDefaults ? null : opt('', 'Ikut Workflow');
  const runnerOptions = [
    isDefaults ? opt('', 'claude-cli (bawaan)') : inherit,
    opt('claude-cli', 'claude-cli', runners?.['claude-cli']?.available === false ? 'tidak tersedia' : 'Login Claude Code'),
    opt('api', 'api', runners?.api?.available === false ? 'ANTHROPIC_API_KEY belum di-set' : 'Claude API key'),
  ];
  return (
    <>
      <Section title="Otak & Model">
        <Field label="Runner" hint={h('runner')}>
          <Select value={target.runner ?? ''} options={runnerOptions} onChange={(v) => set('runner', v || undefined)} />
        </Field>
        <Field label="Model" hint={h('model') ?? 'kosong = model di file agent'}>
          <Combobox value={target.model} placeholder="Ikut agent" suggestions={MODEL_SUGGESTIONS} onChange={(v) => set('model', v)} />
        </Field>
        <Field label="Effort" hint={h('effort')}>
          <Select value={target.effort ?? ''} onChange={(v) => set('effort', v || undefined)}
            options={[opt('', isDefaults ? 'Ikut Agent' : 'Ikut Workflow/Agent'), ...EFFORTS.map((e) => opt(e, e))]} />
        </Field>
      </Section>
      <Section title="Konteks & Izin" defaultOpen={!isDefaults}>
        <Field label="Input Dari" hint="Output node mana yang ikut dikirim. Makin sedikit makin hemat token.">
          <Select value={Array.isArray(target.inputs) ? '' : target.inputs ?? ''} onChange={(v) => set('inputs', v || undefined)} options={[
            isDefaults ? opt('', 'previous (bawaan)') : inherit,
            opt('previous', 'previous', 'Node yang tersambung langsung'),
            opt('all', 'all', 'Semua node sebelumnya'),
            opt('none', 'none', 'Hanya permintaan awal'),
          ]} />
        </Field>
        <Field label="Izin" hint="read-only membuang Edit/Write; Bash hanya git diff/log/status/show dan ls">
          <Select value={target.permission ?? ''} onChange={(v) => set('permission', v || undefined)}
            options={[isDefaults ? opt('', 'Sesuai Tools Agent') : inherit, opt('read-only', 'read-only', 'Tidak boleh mengubah file')]} />
        </Field>
        <NumberField label="Maks Karakter Output Diteruskan" hint={h('max_output_chars')} min="1000" step="1000" value={target.max_output_chars} onChange={(v) => set('max_output_chars', v)} />
      </Section>
      <Section title="Batas & Keandalan" defaultOpen={false}>
        <NumberField label="Max Turns" hint={h('max_turns')} min="1" value={target.max_turns} onChange={(v) => set('max_turns', v)} />
        <NumberField label="Timeout (Menit)" hint={h('timeout_min')} min="1" value={target.timeout_min} onChange={(v) => set('timeout_min', v)} />
        <NumberField label="Retry Kalau Gagal" hint={h('retry')} min="0" max="5" value={target.retry} onChange={(v) => set('retry', v)} />
        <NumberField label="Budget per Node ($)" hint={h('budget_usd')} min="0" step="0.5" value={target.budget_usd} onChange={(v) => set('budget_usd', v)} />
      </Section>
    </>
  );
}
