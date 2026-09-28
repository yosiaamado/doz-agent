import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { CopyBtn } from '../logs/shared.jsx';

const ICONS = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, loading: Loader2 };

// Satu baris pemeriksaan: status, judul, detail, perintah perbaikan (bisa disalin), dan aksi.
export default function CheckRow({ title, check, test, children }) {
  const status = test?.status ?? check?.status ?? 'loading';
  const Icon = ICONS[status] ?? AlertTriangle;
  return (
    <div className={`check-row cs-${status}`}>
      <Icon size={18} className={`check-icon ${status === 'loading' ? 'spin' : ''}`} />
      <div className="check-body">
        <div className="check-title">{title}</div>
        <div className="check-detail">{test?.detail ?? check?.detail ?? 'Memeriksa…'}</div>
        {check?.fix && status !== 'ok' && (
          <div className="check-fix"><code>{check.fix}</code><CopyBtn text={check.fix} /></div>
        )}
        {children}
      </div>
    </div>
  );
}
