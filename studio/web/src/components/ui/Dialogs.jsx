// Pengganti window.confirm / window.prompt: modal yang mengembalikan Promise.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, PencilLine } from 'lucide-react';
import Modal from './Modal.jsx';

const DialogContext = createContext(null);

function ConfirmDialog({ title, message, confirmLabel = 'Lanjut', cancelLabel = 'Batal', tone = 'default', onDone }) {
  return (
    <Modal
      size="sm" title={title} icon={<AlertTriangle size={18} />} iconTone={tone === 'danger' ? 'danger' : ''} onClose={() => onDone(false)}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => onDone(false)}>{cancelLabel}</button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => onDone(true)}>{confirmLabel}</button>
        </>
      )}
    >
      <p className="muted" style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

function PromptDialog({ title, message, label, defaultValue = '', placeholder, multiline, validate, confirmLabel = 'Simpan', onDone }) {
  const [value, setValue] = useState(defaultValue);
  const error = validate?.(value) ?? null;
  const submit = () => { if (!error) onDone(value); };
  const Input = multiline ? 'textarea' : 'input';
  return (
    <Modal
      size="sm" title={title} icon={<PencilLine size={18} />} onClose={() => onDone(null)}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => onDone(null)}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={Boolean(error)} onClick={submit}>{confirmLabel}</button>
        </>
      )}
    >
      {message && <p className="muted small" style={{ marginTop: 0 }}>{message}</p>}
      <label className="field">
        {label && <span className="field-label">{label}</span>}
        <Input
          autoFocus rows={multiline ? 4 : undefined} value={value} placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => !multiline && e.key === 'Enter' && submit()}
        />
        {error && value && <span className="field-hint err">{error}</span>}
      </label>
    </Modal>
  );
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const open = useCallback((kind, props) => new Promise((resolve) => {
    setDialog({ kind, props, resolve });
  }), []);
  const api = useMemo(() => ({
    confirm: (props) => open('confirm', props),
    prompt: (props) => open('prompt', props),
  }), [open]);
  const done = (value) => {
    dialog.resolve(value);
    setDialog(null);
  };
  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog?.kind === 'confirm' && <ConfirmDialog {...dialog.props} onDone={done} />}
      {dialog?.kind === 'prompt' && <PromptDialog {...dialog.props} onDone={done} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
