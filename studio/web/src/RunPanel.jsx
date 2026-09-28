import { useEffect, useRef, useState } from 'react';
import { formatCost, formatDuration, formatTokens } from './model.js';

const KIND_CLASS = { tool: 'k-tool', text: 'k-text', status: 'k-status', tool_error: 'k-err', retry: 'k-err', init: 'k-muted' };

function time(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour12: false });
}

export default function RunPanel({ run, runs, selectedNode, nodeLabel, onSelectRun, onStop, follow, setFollow }) {
  const [tab, setTab] = useState('log');
  const logRef = useRef(null);
  const nodeState = selectedNode ? run.nodes[selectedNode] : null;
  const log = selectedNode ? run.log.filter((l) => l.node === selectedNode) : run.log;

  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  const totals = Object.values(run.nodes).reduce((acc, n) => {
    if (n.status === 'done') acc.done++;
    if (n.status === 'running') acc.running++;
    return acc;
  }, { done: 0, running: 0 });

  return (
    <section className="runpanel">
      <div className="runpanel-head">
        <select value={run.id ?? ''} onChange={(e) => onSelectRun(e.target.value)}>
          <option value="">— pilih run —</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.status === 'running' ? '● ' : ''}{r.workflow} · {r.source === 'claude-code' ? 'Claude Code' : 'studio'} · {new Date(r.started).toLocaleString('id-ID')} · {r.status}
            </option>
          ))}
        </select>
        {run.id && (
          <>
            <span className={`pill pill-${run.status}`}>{run.status}</span>
            <span className="muted">{totals.done} selesai{totals.running ? ` · ${totals.running} berjalan` : ''}</span>
            <span className="cost">{formatCost(run.cost)}</span>
            {run.status === 'running' && run.source === 'studio' && <button className="btn btn-sm btn-no" onClick={onStop}>Stop</button>}
          </>
        )}
        <label className="check follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> ikuti run terbaru
        </label>
        <div className="tabs">
          <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Aktivitas</button>
          <button className={tab === 'output' ? 'active' : ''} onClick={() => setTab('output')} disabled={!selectedNode}>Output node</button>
        </div>
      </div>
      {tab === 'log' || !selectedNode ? (
        <div className="log" ref={logRef}>
          {selectedNode && <div className="log-filter">Hanya {nodeLabel(selectedNode)}. Klik area kosong canvas untuk melihat semua.</div>}
          {run.error && <div className="log-line k-err">{run.error}</div>}
          {log.length === 0 && <div className="muted empty">{run.id ? 'Belum ada aktivitas.' : 'Jalankan workflow atau pilih run. Run dari Claude Code (skill run-workflow) muncul otomatis di sini.'}</div>}
          {log.map((l, i) => (
            <div key={i} className={`log-line ${KIND_CLASS[l.kind] ?? ''}`}>
              <span className="log-time">{time(l.ts)}</span>
              {!selectedNode && <span className="log-node">{l.node ? nodeLabel(l.node) : 'run'}</span>}
              <span className="log-text">{l.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="output">
          {nodeState ? (
            <>
              <div className="output-meta">
                {nodeState.model && <span>{nodeState.model}</span>}
                {nodeState.cost ? <span>{formatCost(nodeState.cost)}</span> : null}
                {nodeState.usage && <span>{formatTokens(nodeState.usage)}</span>}
                {nodeState.turns ? <span>{nodeState.turns} turns</span> : null}
                {nodeState.durationMs ? <span>{formatDuration(nodeState.durationMs)}</span> : null}
              </div>
              <pre>{nodeState.output ?? nodeState.error ?? '(belum ada output)'}</pre>
            </>
          ) : (
            <div className="muted empty">Node ini belum jalan di run ini.</div>
          )}
        </div>
      )}
    </section>
  );
}
