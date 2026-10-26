import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Send, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { codeText, errorMessage } from '../../lib/errorMessage.js';
import { hasActivity } from '../../lib/activity.js';
import { formatCost } from '../../lib/model.js';
import ActivityTree from '../logs/ActivityTree.jsx';

const MAX_LENGTH = 100_000;

function Message({ message, canRetry, onRetry }) {
  const { t } = useI18n();
  if (message.role === 'user' && message.retryOf) {
    return <li className="chat-marker">{t('chat.retried', { turn: message.retryOf })}</li>;
  }
  if (message.role === 'error') {
    const title = codeText(t, 'error', message.errorCode, undefined, message.text);
    const detail = message.errorCode === 'CHAT_TURN_FAILED' ? message.text : '';
    return (
      <li className="chat-msg chat-msg-error" role="alert">
        <div className="chat-bubble">
          <strong><AlertTriangle size={13} aria-hidden="true" /> {title}</strong>
          {detail && <pre className="chat-detail">{detail}</pre>}
          {canRetry && <button type="button" className="btn btn-sm" onClick={onRetry}><RefreshCw size={13} /> {t('common.retry')}</button>}
        </div>
      </li>
    );
  }
  return (
    <li className={`chat-msg chat-msg-${message.role}`}>
      <span className="chat-who">{message.role === 'user' ? t('chat.you') : t('chat.agent')}</span>
      <div className="chat-bubble"><div className="chat-text">{message.text}</div></div>
      {message.cost ? <span className="chat-cost muted small">{formatCost(message.cost)}</span> : null}
    </li>
  );
}

function Composer({ disabled, onSend }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const fieldRef = useRef(null);
  const blocked = disabled || sending;

  const submit = async () => {
    if (blocked || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  useEffect(() => { if (!blocked) fieldRef.current?.focus(); }, [blocked]);

  return (
    <div className="chat-composer">
      {error && <p className="err small" role="alert">{errorMessage(t, error)}</p>}
      <div className="chat-composer-row">
        <textarea
          ref={fieldRef} rows={2} value={text} maxLength={MAX_LENGTH} disabled={blocked} aria-label={t('chat.composer.label')}
          placeholder={disabled ? t('chat.composer.running') : t('chat.composer.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="btn btn-primary" disabled={blocked || !text.trim()} onClick={submit}>
          {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />} {t('chat.composer.send')}
        </button>
      </div>
      <span className="muted small">{t('chat.composer.hint')}</span>
    </div>
  );
}

export default function ChatPanel({
  chat, messages, stream, running, loading = false, error = null, profileName, onRetryLoad, onSend, onRetry, onToggleEdits, onDelete,
}) {
  const { t } = useI18n();
  const dialog = useDialog();
  const notify = useToast();
  const logRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages.length, stream?.current, running]);

  const guard = async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      notify(errorMessage(t, err), 'error');
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const toggleEdits = async (next) => {
    if (next) {
      const ok = await dialog.confirm({ title: t('chat.edits.confirm-title'), message: t('chat.edits.confirm-message'), confirmLabel: t('chat.edits.confirm-button'), tone: 'danger' });
      if (!ok) return;
    }
    await guard(() => onToggleEdits(next));
  };

  const remove = async () => {
    const dir = chat.configDir ?? t('profiles.dir-default');
    const ok = await dialog.confirm({
      title: t('chat.delete.title'), message: t('chat.delete.message', { dir }), confirmLabel: t('common.delete'), tone: 'danger',
    });
    if (!ok) return;
    const result = await guard(() => onDelete());
    if (result) notify(t('chat.delete.done', { dir: result.configDir ?? dir }), 'success');
  };

  const lastMessage = messages.at(-1);
  const canRetry = chat.status === 'failed' && !running;
  return (
    <section className="chat-panel" aria-label={t('chat.panel.aria', { agent: chat.agent })}>
      <header className="chat-head">
        <div className="chat-head-main">
          <strong className="chat-agent">{chat.agent}</strong>
          {profileName && <span className="pill" title={t('chat.profile-hint')}><UserRound size={11} aria-hidden="true" /> {profileName}</span>}
          {chat.allowEdits
            ? <span className="pill chat-pill-warn"><AlertTriangle size={11} aria-hidden="true" /> {t('chat.mode.edits')}</span>
            : <span className="pill"><ShieldCheck size={11} aria-hidden="true" /> {t('chat.mode.read-only')}</span>}
        </div>
        <label className="chat-switch">
          <input type="checkbox" role="switch" checked={chat.allowEdits} disabled={running || busy} onChange={(e) => toggleEdits(e.target.checked)} />
          {t('chat.edits.toggle')}
        </label>
        <button type="button" className="icon-btn" disabled={running || busy} title={t('chat.delete.title')} aria-label={t('chat.delete.title')} onClick={remove}><Trash2 size={16} /></button>
      </header>

      <div className="chat-log" ref={logRef}>
        {loading && <p className="muted" role="status"><Loader2 size={14} className="spin" /> {t('common.loading')}</p>}
        {!loading && error && (
          <div className="chat-note">
            <p className="err" role="alert">{errorMessage(t, error)}</p>
            <button type="button" className="btn btn-sm" onClick={onRetryLoad}><RefreshCw size={13} /> {t('common.retry')}</button>
          </div>
        )}
        {!loading && !error && messages.length === 0 && !running && <p className="muted chat-empty">{t('chat.empty', { agent: chat.agent })}</p>}
        <ol className="chat-messages" role="log" aria-live="polite" aria-label={t('chat.messages.aria')}>
          {messages.map((m) => (
            <Message key={m.id} message={m} canRetry={canRetry && m === lastMessage} onRetry={() => guard(onRetry)} />
          ))}
        </ol>
        {running && (
          <div className="chat-live" role="status">
            <span className="muted small"><Loader2 size={12} className="spin" /> {t('chat.working', { agent: chat.agent })}</span>
            {hasActivity(stream) && <ActivityTree stream={stream} />}
          </div>
        )}
      </div>

      <Composer disabled={running || loading || Boolean(error)} onSend={onSend} />
    </section>
  );
}
