import { useEffect, useRef, useState } from 'react';
import { TypeIcon } from '../../components/icons.jsx';
import { STATUS_TEXT, KIND_CLASS, CopyBtn } from './shared.jsx';
import { InfoTab, FilesTab, CommandTab } from './NodeTabs.jsx';
import { formatCost, formatDuration, formatTime, formatTokens, totalTokens } from '../../lib/model.js';

export default function NodeDetail({ nodeId, node, st, log, git, label }) {
  const [tab, setTab] = useState('info');
  const logRef = useRef(null);
  const lines = log.filter((l) => l.node === nodeId);
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines.length, tab]);
  if (!st) return <div className="empty pad">Node ini belum jalan di run ini.</div>;
  const tokens = totalTokens(st.usage);
  const tabs = [
    ['info', 'Info'], ['input', 'Input'], ['output', 'Output'],
    ['files', `File${st.changes?.length ? ` (${st.changes.length})` : st.touched?.length ? ` (${st.touched.length})` : ''}`],
    ['command', 'Command'], ['activity', 'Aktivitas'],
  ];
  return (
    <div className="detail">
      <div className="detail-head">
        <TypeIcon type={node?.type} size={16} />
        <span className="detail-title">{label}</span>
        <span className={`s-text s-${st.status}`}>{STATUS_TEXT[st.status]}{st.durationMs ? ` dalam ${formatDuration(st.durationMs)}` : ''}</span>
        {tokens > 0 && <span className="muted">{formatTokens(tokens)}</span>}
        {st.cost ? <span className="muted">{formatCost(st.cost)}</span> : null}
        <div className="tabs">
          {tabs.map(([k, t]) => <button type="button" key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{t}</button>)}
        </div>
      </div>
      <div className="detail-body" ref={logRef}>
        {tab === 'info' && <InfoTab st={st} node={node} />}
        {tab === 'input' && (st.prompt
          ? <><div className="subhead">Prompt yang dikirim <CopyBtn text={st.prompt} /></div><pre className="code-block">{st.prompt}</pre></>
          : <div className="empty">{node?.type === 'action' ? 'Action tidak memakai prompt; lihat tab Command.' : 'Tidak ada input prompt untuk node ini.'}</div>)}
        {tab === 'output' && (st.output
          ? <><div className="subhead">Output <CopyBtn text={st.output} /></div><pre className="code-block wrap">{st.output}</pre></>
          : <div className="empty">{st.status === 'running' ? 'Output muncul setelah node selesai. Lihat Aktivitas untuk progres.' : 'Belum ada output.'}</div>)}
        {tab === 'files' && <FilesTab st={st} git={git} />}
        {tab === 'command' && <CommandTab st={st} node={node} />}
        {tab === 'activity' && (
          <div className="log">
            {lines.length === 0 && <div className="empty">Belum ada aktivitas.</div>}
            {lines.map((l, i) => (
              <div key={i} className={`log-line ${KIND_CLASS[l.kind] ?? ''}`}>
                <span className="log-time">{formatTime(l.ts)}</span>
                <span className="log-text">{l.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

