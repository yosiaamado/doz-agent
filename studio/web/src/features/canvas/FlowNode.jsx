import { memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { StudioContext } from '../../state/studioContext.js';
import { useNow } from '../../hooks/useNow.js';
import { TypeIcon, StatusIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { nodeActivityText } from '../../lib/errorMessage.js';
import { AGENT_COLORS, BRANCHING, effectiveSetting, nodeTypeLabel, formatDuration, formatTokens, totalTokens } from '../../lib/model.js';

function caption(t, node, meta, agent) {
  switch (node.type) {
    case 'agent': {
      const model = effectiveSetting('model', node, meta, agent).value;
      const runner = effectiveSetting('runner', node, meta, agent).value;
      return [model, runner === 'api' ? 'API' : 'Claude Code'].filter(Boolean).join(' · ');
    }
    case 'skill': return node.skill ?? t('canvas.caption.pick-skill');
    case 'action': return node.command || node.action || t('canvas.caption.enter-command');
    case 'condition': return node.check || (node.source ? t('canvas.caption.result-of', { source: node.source }) : '');
    case 'approval': return node.message || t('canvas.caption.waiting-you');
    case 'start': return t('canvas.caption.start');
    default: return '';
  }
}

function FlowNode({ id, data, selected }) {
  const { t, tp } = useI18n();
  const { agentsByName, meta, run, onApprove, onEditComponent } = useContext(StudioContext);
  const node = data.node;
  const agent = node.type === 'agent' ? agentsByName[node.agent] : null;
  const st = run.nodes[id] ?? {};
  const status = st.status ?? (run.status === 'idle' ? null : 'pending');
  const now = useNow(status === 'running');
  const wide = node.type === 'agent' || node.type === 'skill';
  const branching = BRANCHING.has(node.type);
  const accent = agent?.color ? AGENT_COLORS[agent.color] ?? agent.color : null;
  const title = node.label || (node.type === 'agent' ? node.agent : node.type === 'skill' ? node.skill?.replace('doz-agent:', '') : node.action || nodeTypeLabel(t, node.type));
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
            <span className="fnode-caption">{caption(t, node, meta, agent)}</span>
          </span>
        )}
        {status && status !== 'pending' && <span className="fnode-status"><StatusIcon status={status} /></span>}
        {editable && (
          <button type="button" className="fnode-edit nodrag" title={t('canvas.node.edit-title')}
            onClick={(e) => { e.stopPropagation(); onEditComponent(node.type === 'agent' ? 'agents' : node.type === 'skill' ? 'skills' : 'actions', node.agent ?? node.skill ?? node.action); }}>
            <Pencil size={12} />
          </button>
        )}
        {branching ? (
          <>
            <Handle id="true" type="source" position={Position.Right} className="fhandle fhandle-yes" style={{ top: '32%' }} />
            <Handle id="false" type="source" position={Position.Right} className="fhandle fhandle-no" style={{ top: '68%' }} />
            <span className="branch-label yes">{t('canvas.branch.yes')}</span>
            <span className="branch-label no">{t('canvas.branch.no')}</span>
          </>
        ) : node.type !== 'output' && <Handle type="source" position={Position.Right} className="fhandle" />}
      </div>
      {!wide && (
        <div className="fnode-label">
          <div className="fnode-title">{title}</div>
          <div className="fnode-caption">{caption(t, node, meta, agent)}</div>
        </div>
      )}
      {(status === 'running' || status === 'waiting') && st.activity && <div className="fnode-activity">{nodeActivityText(t, st)}</div>}
      {status && !['pending', 'skipped'].includes(status) && (tokens > 0 || duration) ? (
        <div className="fnode-metrics">
          {duration ? <span>{formatDuration(t, duration)}</span> : null}
          {tokens > 0 && <span>{formatTokens(t, tokens)}</span>}
          {st.history?.length > 1 && <span>{tp('canvas.metrics.runs', st.history.length)}</span>}
          {st.changes?.length ? <span>{tp('canvas.metrics.files', st.changes.length)}</span> : null}
        </div>
      ) : null}
      {status === 'waiting' && node.type === 'approval' && run.source === 'studio' && (
        <div className="fnode-approve nodrag">
          <button type="button" className="btn btn-xs btn-yes" onClick={() => onApprove(id, true)}>{t('canvas.approve')}</button>
          <button type="button" className="btn btn-xs btn-no" onClick={() => onApprove(id, false)}>{t('canvas.reject')}</button>
        </div>
      )}
    </div>
  );
}

export default memo(FlowNode);
