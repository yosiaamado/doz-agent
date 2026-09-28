import { useState } from 'react';
import { StatusIcon } from '../../components/icons.jsx';
import { formatCost, formatDuration } from '../../lib/model.js';

const STATUS_LABEL = { running: 'Berjalan', done: 'Sukses', failed: 'Gagal', stopped: 'Dihentikan' };

export default function ExecutionsPanel({ runs, workflowName, currentRunId, onSelectRun }) {
  const [all, setAll] = useState(false);
  const list = all ? runs : runs.filter((r) => r.workflow === workflowName);
  return (
    <div className="lexec-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="lexec-head">
        <span>{list.length} Run</span>
        <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Semua Workflow</label>
      </div>
      <div className="lscroll">
        {list.length === 0 && <div className="empty pad">Belum ada run untuk workflow ini.</div>}
        {list.map((r) => (
          <button type="button" key={r.id} className={`lexec ${r.id === currentRunId ? 'active' : ''}`} onClick={() => onSelectRun(r.id)}>
            <StatusIcon status={r.status === 'done' ? 'done' : r.status === 'running' ? 'running' : 'failed'} />
            <span className="lexec-text">
              <span className="lexec-title">{new Date(r.started).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="lexec-sub">
                {STATUS_LABEL[r.status] ?? r.status}{r.duration ? ` dalam ${formatDuration(r.duration)}` : ''} · {r.source === 'claude-code' ? 'Claude Code' : 'Studio'}
                {r.cost ? ` · ${formatCost(r.cost)}` : ''}{all ? ` · ${r.workflow}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
