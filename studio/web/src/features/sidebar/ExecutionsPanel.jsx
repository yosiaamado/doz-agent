import { useState } from 'react';
import { StatusIcon } from '../../components/icons.jsx';
import { formatCost, formatDuration, statusLabel } from '../../lib/model.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

export default function ExecutionsPanel({ runs, workflowName, currentRunId, onSelectRun }) {
  const { t, tp, intl } = useI18n();
  const [all, setAll] = useState(false);
  const list = all ? runs : runs.filter((r) => r.workflow === workflowName);
  return (
    <div className="lexec-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="lexec-head">
        <span>{tp('sidebar.executions.count', list.length)}</span>
        <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('sidebar.executions.all-workflows')}</label>
      </div>
      <div className="lscroll">
        {list.length === 0 && <div className="empty pad">{t('sidebar.executions.empty')}</div>}
        {list.map((r) => (
          <button type="button" key={r.id} className={`lexec ${r.id === currentRunId ? 'active' : ''}`} onClick={() => onSelectRun(r.id)}>
            <StatusIcon status={r.status === 'done' ? 'done' : r.status === 'running' ? 'running' : 'failed'} />
            <span className="lexec-text">
              <span className="lexec-title">{new Date(r.started).toLocaleString(intl, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="lexec-sub">
                {statusLabel(t, r.status)}{r.duration ? ` ${t('common.in-duration', { duration: formatDuration(t, r.duration) })}` : ''} · {r.source === 'claude-code' ? 'Claude Code' : 'Studio'}
                {r.cost ? ` · ${formatCost(r.cost)}` : ''}{all ? ` · ${r.workflow}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
