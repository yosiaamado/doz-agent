import { useState } from 'react';
import { AlertTriangle, Ban, Check, ChevronDown, ChevronRight, Circle, CircleDot, Users, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { KIND_CLASS } from './shared.jsx';

const STATUS_ICON = { running: CircleDot, done: Check, failed: X };
const STATUS_KEY = { running: 'activity.subagent.running', done: 'activity.subagent.done', failed: 'activity.subagent.failed' };

function Line({ line }) {
  const { t } = useI18n();
  const blocked = line.kind === 'blocked';
  return (
    <li className={`act-line ${KIND_CLASS[line.kind] ?? ''} ${blocked ? 'act-blocked' : ''}`}>
      {blocked && <span className="act-tag"><Ban size={12} aria-hidden="true" /> {t('activity.blocked')}</span>}
      <span className="act-text">{line.text}</span>
    </li>
  );
}

function Group({ id, stream, compact }) {
  const { t } = useI18n();
  const group = stream.subagents[id];
  const [open, setOpen] = useState(true);
  const Icon = STATUS_ICON[group.status] ?? Circle;
  const children = Object.keys(stream.subagents).filter((k) => stream.subagents[k].parentId === id);
  return (
    <li className={`act-group act-${group.status}`}>
      <button type="button" className="act-group-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Users size={13} aria-hidden="true" />
        <strong>{group.agent}</strong>
        <span className="act-text muted">{group.text}</span>
        <span className="act-status"><Icon size={12} aria-hidden="true" /> {t(STATUS_KEY[group.status] ?? STATUS_KEY.running)}</span>
      </button>
      {open && (
        <ul className="act-list">
          {group.lines.slice(compact ? -5 : 0).map((l) => <Line key={l.id} line={l} />)}
          {children.map((c) => <Group key={c} id={c} stream={stream} compact={compact} />)}
        </ul>
      )}
    </li>
  );
}

function Todos({ todos }) {
  const { t } = useI18n();
  const done = todos.filter((x) => x.status === 'completed').length;
  return (
    <section className="act-todos" aria-label={t('activity.todos.title')}>
      <div className="act-todos-head">{t('activity.todos.progress', { done, total: todos.length })}</div>
      <ul className="act-list">
        {todos.map((todo, i) => (
          <li key={i} className={`act-todo act-todo-${todo.status}`}>
            {todo.status === 'completed' ? <Check size={13} aria-hidden="true" /> : todo.status === 'in_progress' ? <CircleDot size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
            <span>{todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InitChips({ init }) {
  const { t } = useI18n();
  return (
    <div className="act-chips">
      {init.model && <span className="act-chip">{init.model}</span>}
      {init.apiKeySource && <span className="act-chip">{t('activity.init.key-source', { source: init.apiKeySource })}</span>}
      {init.permissionMode && <span className="act-chip">{init.permissionMode}</span>}
      {(init.mcpServers ?? []).map((m) => (
        <span key={m.name} className={`act-chip act-mcp-${m.status === 'connected' ? 'ok' : 'bad'}`}>
          <span className="act-dot" aria-hidden="true" /> {m.name}: {m.status}
        </span>
      ))}
    </div>
  );
}

export default function ActivityTree({ stream, compact = false }) {
  const { t, intl } = useI18n();
  if (!stream) return null;
  const rl = stream.rateLimit;
  const pct = typeof rl?.utilization === 'number' ? new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 0 }).format(rl.utilization) : null;
  const byId = Object.fromEntries(stream.lines.map((l) => [l.id, l]));
  return (
    <div className="act-tree">
      {stream.init && <InitChips init={stream.init} />}
      {rl && (
        <div className="act-ratelimit" role="status">
          <AlertTriangle size={13} aria-hidden="true" /> {t('activity.rate-limit', { type: rl.rateLimitType ?? '', status: rl.status ?? '' })}{pct ? ` · ${pct}` : ''}
        </div>
      )}
      {stream.todos.length > 0 && <Todos todos={stream.todos} />}
      <ul className="act-list">
        {stream.order.map((id) => (Object.hasOwn(stream.subagents, id)
          ? <Group key={id} id={id} stream={stream} compact={compact} />
          : byId[id] && <Line key={id} line={byId[id]} />))}
      </ul>
    </div>
  );
}
