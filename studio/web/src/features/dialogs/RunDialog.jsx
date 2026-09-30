// Dialog jalankan workflow: permintaan + lampiran dokumen (md, txt, docx, pdf, gambar, file kode).
import { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Play, X } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { api, fileToBase64 } from '../../lib/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const ACCEPT = '.md,.markdown,.txt,.csv,.json,.yaml,.yml,.docx,.pdf,.png,.jpg,.jpeg,.webp,.html,.xml,.js,.jsx,.ts,.tsx,.py,.cs,.java,.go,.sql';

function formatSize(bytes) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function AttachmentList({ items, onRemove }) {
  const { t, tp, intl } = useI18n();
  if (!items.length) return null;
  const chars = (a) => tp('dialogs.run.chars', a.chars, { formatted: a.chars.toLocaleString(intl) });
  const detail = (a) => [a.kind, formatSize(a.size), a.chars ? chars(a) : t('dialogs.run.read-by-path')].join(' · ');
  return (
    <div className="attachments">
      {items.map((a) => (
        <div key={a.key} className="attachment">
          {a.uploading ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
          <span className="name">{a.name}</span>
          <span className="muted small">{a.uploading ? t('dialogs.run.uploading') : detail(a)}</span>
          <button type="button" className="icon-btn" aria-label={t('dialogs.run.remove-attachment', { name: a.name })} onClick={() => onRemove(a.key)}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export default function RunDialog({ workflowName, workdir, onStart, onClose }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);
  const [over, setOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileRef = useRef(null);
  const notify = useToast();

  const upload = async (files) => {
    for (const file of files) {
      const key = `${file.name}-${Math.random()}`;
      setItems((list) => [...list, { key, name: file.name, size: file.size, uploading: true }]);
      try {
        const saved = await api.uploadAttachment(file.name, await fileToBase64(file));
        setItems((list) => list.map((a) => (a.key === key ? { ...a, ...saved, uploading: false } : a)));
      } catch (err) {
        notify(`${file.name}: ${errorMessage(t, err)}`, 'error');
        setItems((list) => list.filter((a) => a.key !== key));
      }
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      await onStart({ input, attachments: items.filter((a) => a.id).map((a) => a.id) });
    } finally {
      setStarting(false);
    }
  };

  const busy = items.some((a) => a.uploading);
  return (
    <Modal
      title={t('dialogs.run.title', { name: workflowName })} subtitle={t('dialogs.run.subtitle', { workdir })}
      icon={<Play size={18} />} onClose={onClose}
      footer={(
        <>
          <span className="muted small">{t('dialogs.run.shortcut')}</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || starting} onClick={start}><Play size={14} /> {t('dialogs.run.start')}</button>
        </>
      )}
    >
      <label className="field" style={{ marginTop: 0 }}>
        <span className="field-label">{t('dialogs.run.request')}</span>
        <textarea autoFocus rows={6} placeholder={t('dialogs.run.request-placeholder')}
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy && start()} />
      </label>
      <div
        className={`dropzone ${over ? 'over' : ''}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]); }}
      >
        <Paperclip size={18} />
        <span>
          <strong>{t('dialogs.run.attach-title')}</strong> {t('dialogs.run.attach-examples')}<br />
          <span className="muted small">{t('dialogs.run.attach-hint')}</span>
        </span>
      </div>
      <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
      <AttachmentList items={items} onRemove={(key) => setItems((list) => list.filter((a) => a.key !== key))} />
    </Modal>
  );
}
