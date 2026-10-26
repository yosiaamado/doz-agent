import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ListChecks, MessageSquarePlus, Play } from 'lucide-react';
import Select from '../../components/ui/Select.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage } from '../../lib/errorMessage.js';
import { deriveOffice, defaultChatAgent } from '../../lib/office.js';
import ChatPanel from '../chat/ChatPanel.jsx';
import ActivityTree from '../logs/ActivityTree.jsx';
import AgentCard from './AgentCard.jsx';

const STATUS_KEY = { idle: 'office.status.idle', running: 'office.status.running', chatting: 'office.status.chatting' };

function chatLabel(chat, intl) {
  if (chat.title) return chat.title;
  return chat.createdAt ? new Date(chat.createdAt).toLocaleString(intl, { dateStyle: 'medium', timeStyle: 'short' }) : chat.id;
}

export default function OfficeView({ agents, run, chats, profiles = [], pick, onPick, onOpenRun }) {
  const { t, intl } = useI18n();
  const notify = useToast();
  const roster = useMemo(() => deriveOffice({ agents, run, chats }), [agents, run, chats]);
  const [creating, setCreating] = useState(false);
  const name = roster.some((a) => a.name === pick) ? pick : defaultChatAgent(roster);
  const agent = roster.find((a) => a.name === name) ?? null;
  const { selected, selectedId, select } = chats;
  const chatId = agent?.chatId ?? null;

  useEffect(() => {
    if (chatId && chatId !== selectedId) select(chatId);
  }, [chatId, selectedId, select]);

  if (!agent) {
    return <div className="office"><p className="office-empty muted">{t('office.empty')}</p></div>;
  }

  const startChat = async () => {
    setCreating(true);
    try {
      await chats.create(agent.name);
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const showChat = chatId && selected?.chat.id === chatId;
  const profile = showChat && profiles.find((p) => p.id === selected.chat.profileId);
  const live = agent.status !== 'idle';
  const history = chats.chats.filter((c) => c.agent === agent.name).map((c) => ({ value: c.id, label: chatLabel(c, intl) }));
  return (
    <div className="office">
      <nav className="office-roster" aria-label={t('office.roster.aria')}>
        <h2 className="eyebrow">{t('office.roster.title')}</h2>
        <ul>
          {roster.map((a) => (
            <li key={a.name}><AgentCard agent={a} selected={a.name === name} onSelect={() => onPick(a.name)} /></li>
          ))}
        </ul>
      </nav>
      <section className="office-detail" aria-label={t('office.detail.aria', { agent: agent.name })}>
        <header className="office-head">
          <div className="office-head-main">
            <h1>{agent.name}</h1>
            <span className={`agent-status st-${agent.status}`}><span className="agent-dot" aria-hidden="true" />{t(STATUS_KEY[agent.status])}</span>
          </div>
          {agent.description && <p className="muted office-desc">{agent.description}</p>}
          <p className="office-now" aria-live="polite">{agent.activity || (live ? t('office.working') : t('office.idle-hint'))}</p>
        </header>

        <div className="office-grid">
          {agent.node && (
            <div className="office-card">
              <h3 className="eyebrow">{t('office.running-node')}</h3>
              <div className="office-row">
                <strong>{agent.node.label}</strong>
                {run?.id && onOpenRun && <button type="button" className="btn btn-xs" onClick={() => onOpenRun(run.id)}><Play size={11} /> {t('office.open-run')}</button>}
              </div>
              <h3 className="eyebrow">{t('office.next')}</h3>
              {agent.next.length === 0
                ? <p className="muted small">{t('office.next.none')}</p>
                : <ul className="office-next">{agent.next.map((n) => <li key={n.id}><ArrowRight size={12} aria-hidden="true" /> {n.label || n.id}</li>)}</ul>}
            </div>
          )}
          {live && (agent.todos.length > 0 || Object.keys(agent.subagents).length > 0) && (
            <div className="office-card office-card-wide">
              <h3 className="eyebrow"><ListChecks size={12} aria-hidden="true" /> {t('office.progress')}</h3>
              <ActivityTree stream={agent.stream} compact />
            </div>
          )}
        </div>

        {showChat ? (
          <div className="office-chat">
            <div className="office-chat-bar">
              <Select value={selected.chat.id} onChange={select} options={history} ariaLabel={t('office.chat.history')} className="office-history" />
              <button type="button" className="btn btn-sm" disabled={creating} onClick={startChat}><MessageSquarePlus size={13} /> {t('office.chat.new-another')}</button>
            </div>
            <ChatPanel
              key={selected.chat.id} chat={selected.chat} messages={selected.messages} stream={selected.stream} running={selected.chat.status === 'running'}
              loading={selected.loading} error={selected.error} profileName={profile?.name ?? selected.chat.profileId} onRetryLoad={chats.retryDetail}
              onSend={chats.send} onRetry={chats.retry} onToggleEdits={chats.setAllowEdits} onDelete={() => chats.remove(selected.chat.id)}
            />
          </div>
        ) : chatId ? (
          <p className="muted office-empty" role="status">{t('common.loading')}</p>
        ) : (
          <div className="office-cta">
            <p>{t('office.chat.none', { agent: agent.name })}</p>
            <button type="button" className="btn btn-primary" disabled={creating} onClick={startChat}><MessageSquarePlus size={14} /> {t('office.chat.start', { agent: agent.name })}</button>
          </div>
        )}
      </section>
    </div>
  );
}
