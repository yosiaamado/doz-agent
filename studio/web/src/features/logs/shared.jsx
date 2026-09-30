import { useState } from 'react';
import { Copy, FilePlus2, FileMinus2, FilePen } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { statusLabel } from '../../lib/model.js';
import { errorMessage } from '../../lib/errorMessage.js';

export const FILE_ICON = { added: FilePlus2, deleted: FileMinus2, modified: FilePen, renamed: FilePen };
export const KIND_CLASS = { tool: 'k-tool', text: 'k-text', status: 'k-status', tool_error: 'k-err', retry: 'k-err', init: 'k-muted' };

export function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// The text of one log line: studio-authored messages (msg) are translated, text from the server/Claude is shown as-is.
export function logText(t, line) {
  if (!line.msg) return line.text;
  const params = { ...line.msg.params };
  if (params.status !== undefined) params.status = statusLabel(t, params.status);
  if (params.errorCode) params.error = errorMessage(t, { code: params.errorCode, params: params.errorParams, message: params.error });
  const text = t(line.msg.key, params);
  return text === line.msg.key ? line.text : text;
}

export function CopyBtn({ text }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-xs" onClick={() => { copy(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      <Copy size={12} /> {done ? t('common.copied') : t('common.copy')}
    </button>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value || '–'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

