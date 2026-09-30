// The one-click update dialog: version check → release notes → the files you edited + the overwrite choice → update → result.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage } from '../../lib/errorMessage.js';

const SKIP_REASON = { 'local-edit': 'update.skip-reason.local-edit' };
const LAST_RESULT = {
  never: 'update.status.never',
  'up-to-date': 'update.status.up-to-date',
  available: 'update.status.available',
  error: 'update.status.error',
};

function formatBytes(n) {
  if (!n) return '0 KB';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1000))} KB`;
}

function FileList({ items }) {
  return (
    <div className="git-files">
      {items.map((f) => <div key={`${f.target}/${f.path}`} className="file-row"><span className="file-path">{f.path}</span></div>)}
    </div>
  );
}

function Available({ result, overwrite, setOverwrite }) {
  const { t, locale, intl } = useI18n();
  const notes = result.notes?.[locale] ?? result.notes?.en ?? '';
  const edits = result.localEdits ?? [];
  const date = result.releasedAt ? new Date(result.releasedAt).toLocaleDateString(intl, { dateStyle: 'medium' }) : '';
  return (
    <section>
      <h3 style={{ margin: '0 0 4px' }}>{t('update.available.title', { version: result.contentVersion })}</h3>
      {result.minAppVersion && <p className="muted small" style={{ marginTop: 0 }}>{t('update.available.needs-app', { minAppVersion: result.minAppVersion })}</p>}
      <p className="muted small" style={{ marginTop: 0 }}>{t('update.available.meta', { date, count: result.fileCount, size: formatBytes(result.totalBytes ?? 0) })}</p>
      {notes && (
        <>
          <div className="subhead">{t('update.notes')}</div>
          {/* Plain text, not HTML: the release notes come from the update server. */}
          <div className="small" style={{ whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{notes}</div>
        </>
      )}
      {edits.length > 0 && (
        <div>
          <div className="editor-note" role="note">
            <AlertTriangle size={14} />
            <span>{t('update.local-edits.body')}</span>
          </div>
          <div className="subhead">{t('update.local-edits.title', { count: edits.length })}</div>
          <FileList items={edits} />
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> {t('update.overwrite')}
          </label>
          <p className="muted small" style={{ marginTop: 4 }}>{t('update.overwrite-hint')}</p>
        </div>
      )}
    </section>
  );
}

function Applied({ applied }) {
  const { t } = useI18n();
  const skipped = applied.skipped ?? [];
  return (
    <section role="status">
      <h3 style={{ margin: '0 0 4px', display: 'flex', gap: 6, alignItems: 'center' }}><CheckCircle2 size={16} /> {t('update.done.title', { version: applied.contentVersion })}</h3>
      <p className="muted small" style={{ marginTop: 0 }}>{t('update.done.summary', { applied: applied.applied, removed: applied.removed })}</p>
      {skipped.length > 0 && (
        <>
          <div className="subhead">{t('update.done.skipped', { count: skipped.length })}</div>
          <div className="git-files">
            {skipped.map((f) => (
              <div key={`${f.target}/${f.path}`} className="file-row">
                <span className="file-path">{f.path}</span>
                <span className="muted small">{Object.hasOwn(SKIP_REASON, f.reason) ? t(SKIP_REASON[f.reason]) : f.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {applied.backupDir && <p className="muted small">{t('update.done.backup', { dir: applied.backupDir })}</p>}
      {applied.reloadWeb && <p className="small">{t('update.done.reload')}</p>}
    </section>
  );
}

export default function UpdateDialog({ update, onClose }) {
  const { t, intl } = useI18n();
  const [overwrite, setOverwrite] = useState(false);
  const { status, result, checking, applying, error, applied, check, apply } = update;
  const busy = checking || applying;
  // A stale check result must not be used when the last check/apply failed (CR-2).
  const showAvailable = Boolean(result?.updateAvailable) && !applied && !error;
  const canApply = showAvailable && !busy;
  const lastChecked = status?.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString(intl) : null;

  return (
    <Modal
      size="lg" title={t('update.title')} subtitle={t('update.subtitle')} icon={<Download size={18} />} onClose={onClose}
      footer={(
        <>
                    <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('common.close')}</button>
          {applied?.reloadWeb && <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={14} /> {t('update.reload')}</button>}
          {/* Stays mounted while applying so keyboard focus does not fall back to <body> (CR-4). */}
          {showAvailable && <button type="button" className="btn btn-primary" disabled={!canApply} onClick={() => apply(overwrite)}><Download size={14} /> {applying ? t('update.applying-short') : t('update.apply')}</button>}
        </>
      )}
    >
      {status && (
        <dl className="stats" style={{ margin: '0 0 16px' }}>
          <div className="stat"><dt className="stat-label">{t('update.version.app')}</dt><dd className="stat-value" style={{ margin: 0 }}>{status.appVersion}</dd><dd className="stat-sub" style={{ margin: 0 }}>{t('update.version.app-hint')}</dd></div>
          <div className="stat"><dt className="stat-label">{t('update.version.content')}</dt><dd className="stat-value" style={{ margin: 0 }}>{status.contentVersion}</dd><dd className="stat-sub" style={{ margin: 0 }}>{t('update.version.content-hint')}</dd></div>
        </dl>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" className="btn" disabled={busy} onClick={check}>
          {checking ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} {checking ? t('update.checking') : t('update.check')}
        </button>
        <span className="muted small" aria-live="polite">
          {status && t(LAST_RESULT[status.lastResult] ?? LAST_RESULT.never)}
          {lastChecked && ` · ${t('update.last-checked', { time: lastChecked })}`}
        </span>
      </div>

      {error && (
        <div className="editor-note" role="alert">
          <AlertTriangle size={14} />
          <span>{errorMessage(t, error)}{error.details?.length ? ` (${error.details.join('; ')})` : ''}</span>
        </div>
      )}

      {applying && <p className="small" role="status"><Loader2 size={14} className="spin" /> {t('update.applying')}</p>}
      {applied && <Applied applied={applied} />}
      {showAvailable && <Available result={result} overwrite={overwrite} setOverwrite={setOverwrite} />}
      {!applied && result && !result.updateAvailable && !error && <p className="small">{t('update.up-to-date', { version: result.currentContentVersion })}</p>}
    </Modal>
  );
}
