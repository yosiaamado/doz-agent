// Pemakaian Claude Code: batas 5 jam & 7 hari (dari rate_limit_event) + token lokal dari transcript.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatTokens } from '../../lib/model.js';
import { usePopover } from '../../components/ui/usePopover.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage } from '../../lib/errorMessage.js';

const WINDOWS = [
  { key: 'five_hour', label: 'topbar.usage.window-five' },
  { key: 'seven_day', label: 'topbar.usage.window-week' },
];
const POLL_MS = 30_000;

function levelClass(pct) {
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'mid';
  return '';
}

function formatReset(t, intl, epochSeconds) {
  if (!epochSeconds) return '';
  const d = new Date(epochSeconds * 1000);
  return t('topbar.usage.reset', { time: d.toLocaleString(intl, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) });
}

function percent(window) {
  return window?.utilization === undefined ? null : Math.round(window.utilization * 100);
}

function UsageBar({ pct }) {
  return <div className={`bar ${levelClass(pct ?? 0)}`}><span style={{ width: `${Math.min(pct ?? 0, 100)}%` }} /></div>;
}

function UsagePopover({ data, refreshing, onRefresh }) {
  const { t, intl } = useI18n();
  const windows = data?.limits?.unifiedWindows ?? {};
  return (
    <div className="usage-pop">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>{t('topbar.usage.title')}</strong>
        <span className="spacer" />
        <button type="button" className="btn btn-xs" disabled={refreshing} onClick={onRefresh} title={t('topbar.usage.refresh-title')}>
          <RefreshCw size={12} className={refreshing ? 'spin' : ''} /> {t('topbar.usage.refresh')}
        </button>
      </div>
      {!data?.limits && <p className="muted small">{t('topbar.usage.empty')}</p>}
      {WINDOWS.map(({ key, label }) => {
        const pct = percent(windows[key]);
        const local = data?.local?.[key];
        return (
          <div key={key} className="usage-row">
            <div className="usage-row-head"><span>{t(label)}</span><strong>{pct === null ? '–' : `${pct}%`}</strong></div>
            <UsageBar pct={pct} />
            <div className="usage-models">
              <span>{formatReset(t, intl, windows[key]?.resetsAt)}</span><span />
              {local && <><span>{t('topbar.usage.local-tokens', { messages: local.messages })}</span><span>{formatTokens(t, local.tokens)}</span></>}
              {local && Object.entries(local.byModel).map(([model, tokens]) => (
                <span key={model} style={{ display: 'contents' }}><span>· {model}</span><span>{formatTokens(t, tokens)}</span></span>
              ))}
            </div>
          </div>
        );
      })}
      {data?.limitsUpdatedAt && <p className="muted small" style={{ marginBottom: 0 }}>{t('topbar.usage.updated', { time: new Date(data.limitsUpdatedAt).toLocaleString(intl) })}</p>}
    </div>
  );
}

export default function UsageWidget() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const style = usePopover(btnRef, open, { minWidth: 330, maxHeight: 520 });
  const notify = useToast();
  useClickOutside([btnRef, popRef], () => setOpen(false), open);

  const load = useCallback(() => api.usage().then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await api.refreshUsage());
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const windows = data?.limits?.unifiedWindows ?? {};
  const five = percent(windows.five_hour);
  const week = percent(windows.seven_day);
  return (
    <>
      <button ref={btnRef} type="button" className="btn btn-ghost usage-btn" onClick={() => setOpen((o) => !o)}
        title={t('topbar.usage.title')} aria-expanded={open}>
        <Gauge size={16} />
        <span className="usage-mini" aria-hidden="true"><UsageBar pct={five} /><UsageBar pct={week} /></span>
        <span className="small">{week === null ? t('topbar.usage.button') : `${week}%`}</span>
      </button>
      {open && style && createPortal(
        <div ref={popRef} className="popover" style={{ ...style, maxHeight: 'none' }}>
          <UsagePopover data={data} refreshing={refreshing} onRefresh={refresh} />
        </div>,
        document.body,
      )}
    </>
  );
}
