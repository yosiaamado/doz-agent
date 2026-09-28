import { ChevronDown, ChevronUp, Square } from 'lucide-react';
import { useNow } from '../../hooks/useNow.js';
import { TypeIcon, StatusIcon } from '../../components/icons.jsx';
import { STATUS_TEXT, KIND_CLASS } from './shared.jsx';
import NodeDetail from './NodeDetail.jsx';
import { NODE_META, formatCost, formatDuration, formatTime, formatTokens, runTokens, totalTokens } from '../../lib/model.js';

function RunSummary({ run }) {
  const now = useNow(run.status === 'running');
  const duration = run.startedAt ? (run.endedAt ?? now) - run.startedAt : null;
  return (
    <span className={`s-text s-${run.status}`}>
      {STATUS_TEXT[run.status] ?? run.status}{duration ? ` dalam ${formatDuration(duration)}` : ''}
      <span className="muted"> · {formatTokens(runTokens(run))} · {formatCost(run.cost)}</span>
    </span>
  );
}

export default function LogsPanel({ run, nodesById, selectedNode, onSelectNode, onStop, open, setOpen, git }) {
  const label = (id) => nodesById[id]?.label || nodesById[id]?.agent || nodesById[id]?.skill?.replace('doz-agent:', '') || NODE_META[nodesById[id]?.type]?.label || id;
  const order = run.order.filter((id) => nodesById[id]?.type !== 'info');
  return (
    <section className={`logs ${open ? 'open' : 'closed'}`}>
      <div className="logs-bar" onDoubleClick={() => setOpen(!open)}>
        <span className="logs-title">Logs</span>
        {run.id ? <RunSummary run={run} /> : <span className="muted">Belum ada run dipilih</span>}
        {run.source === 'claude-code' && <span className="tag">dari Claude Code</span>}
        <span className="spacer" />
        {run.status === 'running' && run.source === 'studio' && (
          <button type="button" className="btn btn-xs btn-no" onClick={onStop}><Square size={11} /> Stop</button>
        )}
        <button type="button" className="icon-btn" onClick={() => setOpen(!open)} title={open ? 'Kecilkan' : 'Buka'}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {open && (
        <div className="logs-body">
          <div className="tree">
            {!run.id && <div className="empty pad">Jalankan workflow atau pilih run di tab Executions. Run dari Claude Code (skill run-workflow) muncul otomatis.</div>}
            {run.error && <div className="tree-error">{run.error}</div>}
            {order.map((id) => {
              const st = run.nodes[id] ?? {};
              const tokens = (st.history ?? []).reduce((a, h) => a + totalTokens(h.usage), 0) + (st.status === 'running' ? totalTokens(st.usage) : 0);
              return (
                <button type="button" key={id} className={`tree-row ${selectedNode === id ? 'active' : ''}`} onClick={() => onSelectNode(id)}>
                  <StatusIcon status={st.status} />
                  <TypeIcon type={nodesById[id]?.type} size={14} />
                  <span className="tree-label">{label(id)}</span>
                  {st.history?.length > 1 && <span className="tag">{st.history.length}x</span>}
                  <span className="tree-meta">{tokens ? formatTokens(tokens) : ''}</span>
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
                      <span className="log-time">{formatTime(l.ts)}</span>
                      <span className="log-node">{l.node ? label(l.node) : 'run'}</span>
                      <span className="log-text">{l.text}</span>
                    </div>
                  ))}
                  {run.id && run.log.length === 0 && <div className="empty">Belum ada aktivitas.</div>}
                </div>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
