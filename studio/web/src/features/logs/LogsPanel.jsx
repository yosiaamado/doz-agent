import { ChevronDown, ChevronUp, Square } from 'lucide-react';
import { useNow } from '../../hooks/useNow.js';
import { TypeIcon, StatusIcon } from '../../components/icons.jsx';
import { KIND_CLASS, logText } from './shared.jsx';
import { nodeErrorText } from '../../lib/errorMessage.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import NodeDetail from './NodeDetail.jsx';
import { formatCost, formatDuration, formatTime, formatTokens, nodeTypeLabel, runTokens, statusLabel, totalTokens } from '../../lib/model.js';

function RunSummary({ run }) {
  const { t } = useI18n();
  const now = useNow(run.status === 'running');
  const duration = run.startedAt ? (run.endedAt ?? now) - run.startedAt : null;
  return (
    <span className={`s-text s-${run.status}`}>
      {statusLabel(t, run.status)}{duration ? ` ${t('common.in-duration', { duration: formatDuration(t, duration) })}` : ''}
      <span className="muted"> · {formatTokens(t, runTokens(run))} · {formatCost(run.cost)}</span>
    </span>
  );
}

export default function LogsPanel({ run, nodesById, selectedNode, onSelectNode, onStop, open, setOpen, git }) {
  const { t, intl } = useI18n();
  const label = (id) => nodesById[id]?.label || nodesById[id]?.agent || nodesById[id]?.skill?.replace('doz-agent:', '') || nodeTypeLabel(t, nodesById[id]?.type) || id;
  const order = run.order.filter((id) => nodesById[id]?.type !== 'info');
  return (
    <section className={`logs ${open ? 'open' : 'closed'}`}>
      <div className="logs-bar" onDoubleClick={() => setOpen(!open)}>
        <span className="logs-title">{t('logs.title')}</span>
        {run.id ? <RunSummary run={run} /> : <span className="muted">{t('logs.no-run')}</span>}
        {run.source === 'claude-code' && <span className="tag">{t('logs.tag.claude-code')}</span>}
        <span className="spacer" />
        {run.status === 'running' && run.source === 'studio' && (
          <button type="button" className="btn btn-xs btn-no" onClick={onStop}><Square size={11} /> {t('logs.stop')}</button>
        )}
        <button type="button" className="icon-btn" onClick={() => setOpen(!open)} title={open ? t('logs.collapse') : t('logs.expand')} aria-label={open ? t('logs.collapse') : t('logs.expand')}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {open && (
        <div className="logs-body">
          <div className="tree">
            {!run.id && <div className="empty pad">{t('logs.empty-hint')}</div>}
            {run.error && <div className="tree-error">{nodeErrorText(t, run)}</div>}
            {order.map((id) => {
              const st = run.nodes[id] ?? {};
              const tokens = (st.history ?? []).reduce((a, h) => a + totalTokens(h.usage), 0) + (st.status === 'running' ? totalTokens(st.usage) : 0);
              return (
                <button type="button" key={id} className={`tree-row ${selectedNode === id ? 'active' : ''}`} onClick={() => onSelectNode(id)}>
                  <StatusIcon status={st.status} />
                  <TypeIcon type={nodesById[id]?.type} size={14} />
                  <span className="tree-label">{label(id)}</span>
                  {st.history?.length > 1 && <span className="tag">{st.history.length}x</span>}
                  <span className="tree-meta">{tokens ? formatTokens(t, tokens) : ''}</span>
                </button>
              );
            })}
          </div>
          {selectedNode
            ? <NodeDetail nodeId={selectedNode} node={nodesById[selectedNode]} st={run.nodes[selectedNode]} log={run.log} git={git} label={label(selectedNode)} />
            : (
              <div className="detail">
                <div className="log run-log">
                  {run.log.map((l, i) => (
                    <div key={i} className={`log-line ${KIND_CLASS[l.kind] ?? ''}`}>
                      <span className="log-time">{formatTime(intl, l.ts)}</span>
                      <span className="log-node">{l.node ? label(l.node) : t('logs.run-label')}</span>
                      <span className="log-text">{logText(t, l)}</span>
                    </div>
                  ))}
                  {run.id && run.log.length === 0 && <div className="empty">{t('logs.no-activity')}</div>}
                </div>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
