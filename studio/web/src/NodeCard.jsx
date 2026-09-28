import { createContext, memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_META, AGENT_COLORS, BRANCHING, effectiveSetting, formatCost, formatTokens, formatDuration } from './model.js';

export const StudioContext = createContext(null);

const STATUS_LABEL = {
  pending: 'menunggu', running: 'berjalan', done: 'selesai', failed: 'gagal', skipped: 'dilewati',
  waiting: 'butuh keputusan', stopped: 'dihentikan',
};

function subtitle(node, meta, agent) {
  if (node.type === 'agent') {
    const model = effectiveSetting('model', node, meta, agent).value;
    const runner = effectiveSetting('runner', node, meta, agent).value;
    return [node.agent || 'pilih agent', model, runner === 'api' ? 'API' : 'CLI'].filter(Boolean).join(' · ');
  }
  if (node.type === 'skill') return node.skill || 'pilih skill';
  if (node.type === 'condition') return node.check || (node.source ? `VERDICT dari ${node.source}` : 'isi pertanyaan');
  if (node.type === 'approval') return node.message || 'Menunggu persetujuanmu';
  if (node.type === 'start') return node.input ? `default: ${node.input}` : 'Input saat run';
  return '';
}

function NodeCard({ id, data, selected }) {
  const { agentsByName, meta, run, onApprove } = useContext(StudioContext);
  const node = data.node;
  const typeMeta = NODE_META[node.type] ?? NODE_META.agent;
  const agent = node.type === 'agent' ? agentsByName[node.agent] : null;
  const accent = agent?.color ? AGENT_COLORS[agent.color] ?? agent.color : null;
  const st = run.nodes[id] ?? {};
  const status = st.status ?? (run.status === 'idle' ? null : 'pending');
  const branching = BRANCHING.has(node.type);

  if (node.type === 'info') {
    return (
      <div className={`node node-info ${selected ? 'selected' : ''}`}>
        <div className="info-title"><span className="glyph">ℹ</span>{node.label || 'Info'}</div>
        <div className="info-text">{node.text || 'Tulis informasi di panel kanan'}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div
      className={`node node-${node.type} ${selected ? 'selected' : ''} ${status ? `st-${status}` : ''}`}
      style={accent ? { '--accent': accent } : undefined}
    >
      {node.type !== 'start' && <Handle type="target" position={Position.Left} />}
      <div className="node-head">
        <span className="glyph">{typeMeta.glyph}</span>
        <span className="node-title">{node.label || (node.type === 'agent' ? node.agent : typeMeta.label)}</span>
        {agent?.canEdit && <span className="chip" title="Agent ini bisa mengubah file">edit</span>}
      </div>
      <div className="node-sub">{subtitle(node, meta, agent)}</div>
      {status && (
        <div className="node-status">
          <span className={`pill pill-${status}`}>{STATUS_LABEL[status] ?? status}</span>
          {st.loop ? <span className="chip">ulang {st.loop}</span> : null}
          {st.attempts > 1 ? <span className="chip">coba {st.attempts}</span> : null}
          {st.verdict !== undefined && st.verdict !== null && status === 'done' && (
            <span className={`chip ${st.verdict ? 'chip-yes' : 'chip-no'}`}>
              {branching ? (st.verdict ? 'ya' : 'tidak') : st.verdict ? 'PASS' : 'FAIL'}
            </span>
          )}
        </div>
      )}
      {(status === 'running' || status === 'waiting') && st.activity && <div className="node-activity">{st.activity}</div>}
      {status === 'failed' && st.error && <div className="node-activity err">{st.error}</div>}
      {st.warning && <div className="node-activity warn">{st.warning}</div>}
      {status === 'done' && (st.cost || st.usage || st.durationMs) ? (
        <div className="node-metrics">
          {st.cost ? <span>{formatCost(st.cost)}</span> : null}
          {st.usage ? <span>{formatTokens(st.usage)}</span> : null}
          {st.durationMs ? <span>{formatDuration(st.durationMs)}</span> : null}
        </div>
      ) : null}
      {status === 'waiting' && node.type === 'approval' && run.source === 'studio' && (
        <div className="node-actions nodrag">
          <button className="btn btn-sm btn-yes" onClick={() => onApprove(id, true)}>Setujui</button>
          <button className="btn btn-sm btn-no" onClick={() => onApprove(id, false)}>Tolak</button>
        </div>
      )}
      {branching ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '35%' }} className="handle-yes" />
          <Handle id="false" type="source" position={Position.Right} style={{ top: '70%' }} className="handle-no" />
          <span className="handle-label yes">ya</span>
          <span className="handle-label no">tidak</span>
        </>
      ) : node.type !== 'output' ? (
        <Handle type="source" position={Position.Right} />
      ) : null}
    </div>
  );
}

export default memo(NodeCard);
