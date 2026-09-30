import { useEffect, useRef, useState } from 'react';
import { TypeIcon } from '../../components/icons.jsx';
import { KIND_CLASS, CopyBtn, logText } from './shared.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { InfoTab, FilesTab, CommandTab } from './NodeTabs.jsx';
import { formatCost, formatDuration, formatTime, formatTokens, statusLabel, totalTokens } from '../../lib/model.js';

export default function NodeDetail({ nodeId, node, st, log, git, label }) {
  const { t, intl } = useI18n();
  const [tab, setTab] = useState('info');
  const logRef = useRef(null);
  const lines = log.filter((l) => l.node === nodeId);
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines.length, tab]);
  if (!st) return <div className="empty pad">{t('logs.detail.not-run')}</div>;
  const tokens = totalTokens(st.usage);
  const tabs = [
    ['info', t('logs.tab.info')], ['input', t('logs.tab.input')], ['output', t('logs.tab.output')],
    ['files', st.changes?.length || st.touched?.length ? t('logs.tab.files-count', { count: st.changes?.length || st.touched.length }) : t('logs.tab.files')],
    ['command', t('logs.tab.command')], ['activity', t('logs.tab.activity')],
  ];
  return (
    <div className="detail">
      <div className="detail-head">
        <TypeIcon type={node?.type} size={16} />
        <span className="detail-title">{label}</span>
        <span className={`s-text s-${st.status}`}>{statusLabel(t, st.status)}{st.durationMs ? ` ${t('common.in-duration', { duration: formatDuration(t, st.durationMs) })}` : ''}</span>
        {tokens > 0 && <span className="muted">{formatTokens(t, tokens)}</span>}
        {st.cost ? <span className="muted">{formatCost(st.cost)}</span> : null}
        <div className="tabs">
          {tabs.map(([k, name]) => <button type="button" key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{name}</button>)}
        </div>
      </div>
      <div className="detail-body" ref={logRef}>
        {tab === 'info' && <InfoTab st={st} node={node} />}
        {tab === 'input' && (st.prompt
          ? <><div className="subhead">{t('logs.detail.prompt-sent')} <CopyBtn text={st.prompt} /></div><pre className="code-block">{st.prompt}</pre></>
          : <div className="empty">{node?.type === 'action' ? t('logs.detail.input-action') : t('logs.detail.no-input')}</div>)}
        {tab === 'output' && (st.output
          ? <><div className="subhead">{t('logs.tab.output')} <CopyBtn text={st.output} /></div><pre className="code-block wrap">{st.output}</pre></>
          : <div className="empty">{st.status === 'running' ? t('logs.detail.output-running') : t('logs.detail.no-output')}</div>)}
        {tab === 'files' && <FilesTab st={st} git={git} />}
        {tab === 'command' && <CommandTab st={st} node={node} />}
        {tab === 'activity' && (
          <div className="log">
            {lines.length === 0 && <div className="empty">{t('logs.no-activity')}</div>}
            {lines.map((l, i) => (
              <div key={i} className={`log-line ${KIND_CLASS[l.kind] ?? ''}`}>
                <span className="log-time">{formatTime(intl, l.ts)}</span>
                <span className="log-text">{logText(t, l)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

