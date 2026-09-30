import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, XCircle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { checkDetail, codeText } from '../../lib/errorMessage.js';
import { CopyBtn } from '../logs/shared.jsx';

const ICONS = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, loading: Loader2, skipped: CircleSlash };

// Satu baris pemeriksaan: status, judul, detail, perintah perbaikan (bisa disalin), dan aksi.
export default function CheckRow({ title, check, test, children }) {
  const { t } = useI18n();
  const status = test?.status ?? check?.status ?? 'loading';
  const Icon = ICONS[status] ?? AlertTriangle;
  return (
    <div className={`check-row cs-${status}`}>
      <Icon size={18} className={`check-icon ${status === 'loading' ? 'spin' : ''}`} />
      <div className="check-body">
        <div className="check-title">{title}</div>
        <div className="check-detail">{test ? checkDetail(t, test) : check ? checkDetail(t, check) : t('setup.checking')}</div>
        {check?.fix && status !== 'ok' && (
          <div className="check-fix"><code>{codeText(t, 'setup.fix', check.fixCode, undefined, check.fix)}</code><CopyBtn text={check.fix} /></div>
        )}
        {children}
      </div>
    </div>
  );
}
