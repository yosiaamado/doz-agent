// Workflow baru: nama + titik awal (kosong atau salinan workflow/template yang ada).
import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export default function NewWorkflowDialog({ workflows, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState(null);
  const taken = workflows.some((w) => w.name === name);
  const error = !name ? null : !NAME_RE.test(name) ? 'Hanya huruf, angka, - dan _' : taken ? 'Nama sudah dipakai' : null;
  const choices = [{ name: null, description: 'Mulai dari node Start saja.' }, ...workflows];
  const submit = () => { if (name && !error) onCreate(name, from); };
  return (
    <Modal
      size="lg" title="Workflow Baru" subtitle="Pilih titik awal. Semua bisa diubah lagi di canvas." icon={<FilePlus2 size={18} />} onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={!name || Boolean(error)} onClick={submit}>Buat Workflow</button>
        </>
      )}
    >
      <Field label="Nama File" hint={error ?? 'Disimpan sebagai <nama>.md di folder workflow pertama.'}>
        <input autoFocus value={name} placeholder="mis. perbaikan-bug" onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      <div className="field">
        <span className="field-label">Mulai dari</span>
        <div className="template-grid">
          {choices.map((w) => (
            <button key={w.name ?? '__blank'} type="button" className={`template ${from === w.name ? 'active' : ''}`} onClick={() => setFrom(w.name)}>
              <span className="template-title">{w.name ?? 'Kosong'}</span>
              <span className="template-desc">{w.description || `${w.nodes} node`}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
