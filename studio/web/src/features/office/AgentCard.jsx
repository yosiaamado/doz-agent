import { Pin } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const STATUS_KEY = { idle: 'office.status.idle', running: 'office.status.running', chatting: 'office.status.chatting' };

export default function AgentCard({ agent, selected, onSelect }) {
  const { t } = useI18n();
  const status = agent.status === 'running' && agent.node
    ? t('office.status.running-node', { node: agent.node.label })
    : t(STATUS_KEY[agent.status] ?? STATUS_KEY.idle);
  return (
    <button type="button" className={`agent-card ${selected ? 'active' : ''}`} aria-pressed={selected} onClick={onSelect}>
      <span className="agent-avatar" aria-hidden="true">{agent.name.charAt(0).toUpperCase()}</span>
      <span className="agent-card-main">
        <span className="agent-card-top">
          <strong className="agent-name">{agent.name}</strong>
          {agent.pinned && <Pin size={12} className="agent-pin" aria-label={t('office.pinned')} />}
        </span>
        <span className={`agent-status st-${agent.status}`}><span className="agent-dot" aria-hidden="true" />{status}</span>
        <span className="agent-activity">{agent.activity || agent.description || t('office.no-activity')}</span>
      </span>
    </button>
  );
}
