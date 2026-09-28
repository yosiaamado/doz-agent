import { memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { StudioContext } from '../../state/studioContext.js';
import { useNow } from '../../hooks/useNow.js';
import { TypeIcon, StatusIcon } from '../../components/icons.jsx';
import { AGENT_COLORS, BRANCHING, NODE_META, effectiveSetting, formatDuration, formatTokens, totalTokens } from '../../lib/model.js';

function caption(node, meta, agent) {
  switch (node.type) {
    case 'agent': {
      const model = effectiveSetting('model', node, meta, agent).value;
      const runner = effectiveSetting('runner', node, meta, agent).value;
      return [model, runner === 'api' ? 'API' : 'Claude Code'].filter(Boolean).join(' · ');
    }
    case 'skill': return node.skill ?? 'pilih skill';
    case 'action': return node.command || node.action || 'isi perintah';
    case 'condition': return node.check || (node.source ? `hasil ${node.source}` : '');
    case 'approval': return node.message || 'menunggu kamu';
    case 'start': return 'saat workflow dijalankan';
    default: return '';
  }
}

function FlowNode({ id, data, selected }) {
  const { agentsByName, meta, run, onApprove, onEditComponent } = useContext(StudioContext);
  const node = data.node;
  const agent = node.type === 'agent' ? agentsByName[node.agent] : null;
  const st = run.nodes[id] ?? {};
  const status = st.status ?? (run.status === 'idle' ? null : 'pending');
  const now = useNow(status === 'running');
  const wide = node.type === 'agent' || node.type === 'skill';
  const branching = BRANCHING.has(node.type);
  const accent = agent?.color ? AGENT_COLORS[agent.color] ?? agent.color : null;
  const title = node.label || (node.type === 'agent' ? node.agent : node.type === 'skill' ? node.skill?.replace('doz-agent:', '') : node.action || NODE_META[node.type]?.label);
  const tokens = totalTokens(st.usage);
  const duration = status === 'running' && st.startedAt ? now - st.startedAt : st.durationMs;
  const editable = (node.type === 'agent' && agent) || (node.type === 'skill' && node.skill) || (node.type === 'action' && node.action);

  return (
    <div className={`fnode ${wide ? 'fnode-wide' : 'fnode-square'} t-${node.type} ${status ? `st-${status}` : ''} ${selected ? 'selected' : ''}`}>
      <div className="fnode-box" style={accent ? { '--accent': accent } : undefined}>
        {node.type !== 'start' && <Handle type="target" position={Position.Left} className="fhandle" />}
        {node.type === 'start' && <span className="trigger-bolt"><TypeIcon type="start" size={12} /></span>}
        <span className="fnode-icon"><TypeIcon type={node.type} size={wide ? 22 : 30} /></span>
        {wide && (
          <span className="fnode-inner">
            <span className="fnode-title">{title}</span>
            <span className="fnode-caption">{caption(node, meta, agent)}</span>
          </span>
        )}
        {status && status !== 'pending' && <span className="fnode-status"><StatusIcon status={status} /></span>}
        {editable && (
          <button type="button" className="fnode-edit nodrag" title="Edit file komponen"
            onClick={(e) => { e.stopPropagation(); onEditComponent(node.type === 'agent' ? 'agents' : node.type === 'skill' ? 'skills' : 'actions', node.agent ?? node.skill ?? node.action); }}>
            <Pencil size={12} />
          </button>
        )}
        {branching ? (
          <>
            <Handle id="true" type="source" position={Position.Right} className="fhandle fhandle-yes" style={{ top: '32%' }} />
            <Handle id="false" type="source" position={Position.Right} className="fhandle fhandle-no" style={{ top: '68%' }} />
            <span className="branch-label yes">ya</span>
            <span className="branch-label no">tidak</span>
          </>
        ) : node.type !== 'output' && <Handle type="source" position={Position.Right} className="fhandle" />}
      </div>
      {!wide && (
        <div className="fnode-label">
          <div className="fnode-title">{title}</div>
          <div className="fnode-caption">{caption(node, meta, agent)}</div>
        </div>
      )}
      {(status === 'running' || status === 'waiting') && st.activity && <div className="fnode-activity">{st.activity}</div>}
      {status && !['pending', 'skipped'].includes(status) && (tokens > 0 || duration) ? (
        <div className="fnode-metrics">
          {duration ? <span>{formatDuration(duration)}</span> : null}
          {tokens > 0 && <span>{formatTokens(tokens)}</span>}
          {st.history?.length > 1 && <span>{st.history.length}x jalan</span>}
          {st.changes?.length ? <span>{st.changes.length} file</span> : null}
        </div>
      ) : null}
      {status === 'waiting' && node.type === 'approval' && run.source === 'studio' && (
        <div className="fnode-approve nodrag">
          <button type="button" className="btn btn-xs btn-yes" onClick={() => onApprove(id, true)}>Setujui</button>
          <button type="button" className="btn btn-xs btn-no" onClick={() => onApprove(id, false)}>Tolak</button>
        </div>
      )}
    </div>
  );
}

export default memo(FlowNode);
