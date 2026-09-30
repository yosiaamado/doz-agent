// Workflow baru: nama + titik awal (kosong atau salinan workflow/template yang ada).
import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export default function NewWorkflowDialog({ workflows, onCreate, onClose }) {
  const { t, tp } = useI18n();
  const [name, setName] = useState('');
  const [from, setFrom] = useState(null);
  const taken = workflows.some((w) => w.name === name);
  const error = !name ? null : !NAME_RE.test(name) ? t('dialogs.new-workflow.name-invalid') : taken ? t('dialogs.new-workflow.name-taken') : null;
  const choices = [{ name: null, description: t('dialogs.new-workflow.blank-desc') }, ...workflows];
  const submit = () => { if (name && !error) onCreate(name, from); };
  return (
    <Modal
      size="lg" title={t('dialogs.new-workflow.title')} subtitle={t('dialogs.new-workflow.subtitle')} icon={<FilePlus2 size={18} />} onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!name || Boolean(error)} onClick={submit}>{t('dialogs.new-workflow.create')}</button>
        </>
      )}
    >
      <Field label={t('dialogs.new-workflow.field.name')} hint={error ?? t('dialogs.new-workflow.name-hint')}>
        <input autoFocus value={name} placeholder={t('dialogs.new-workflow.name-placeholder')} onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      <div className="field">
        <span className="field-label">{t('dialogs.new-workflow.start-from')}</span>
        <div className="template-grid">
          {choices.map((w) => (
            <button key={w.name ?? '__blank'} type="button" className={`template ${from === w.name ? 'active' : ''}`} onClick={() => setFrom(w.name)}>
              <span className="template-title">{w.name ?? t('dialogs.new-workflow.blank')}</span>
              <span className="template-desc">{w.description || tp('dialogs.new-workflow.node-count', w.nodes)}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
