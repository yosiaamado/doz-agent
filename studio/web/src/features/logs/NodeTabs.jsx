import { useEffect, useState } from 'react';
import { FileDiff, FilePen } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useNow } from '../../hooks/useNow.js';
import DiffView from './DiffView.jsx';
import { FILE_ICON, CopyBtn, Stat } from './shared.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage, nodeErrorText, nodeWarningText } from '../../lib/errorMessage.js';
import { formatCost, formatDuration, formatTime, formatTokens, statusLabel, totalTokens } from '../../lib/model.js';

export function InfoTab({ st, node }) {
  const { t, tp, intl } = useI18n();
  const now = useNow(st.status === 'running');
  const duration = st.status === 'running' && st.startedAt ? now - st.startedAt : st.durationMs;
  const u = st.usage;
  const history = st.history ?? [];
  const settings = st.settings ?? {};
  return (
    <div className="info-tab">
      <div className="stats">
        <Stat label={t('logs.info.status')} value={<span className={`pill pill-${st.status}`}>{statusLabel(t, st.status)}</span>} sub={st.warning ? nodeWarningText(t, st) : st.error ? nodeErrorText(t, st) : null} />
        <Stat label={t('logs.info.started')} value={formatTime(intl, st.startedAt)} sub={st.endedAt ? t('logs.info.ended', { time: formatTime(intl, st.endedAt) }) : null} />
        <Stat label={t('logs.info.duration')} value={formatDuration(t, duration)} sub={st.status === 'running' ? t('logs.info.still-running') : null} />
        <Stat label={t('logs.info.tokens')} value={u ? formatTokens(t, totalTokens(u)) : null}
          sub={u ? t('logs.info.token-detail', { input: u.input ?? 0, output: u.output ?? 0, cache: (u.cacheRead ?? 0) + (u.cacheWrite ?? 0) }) : null} />
        <Stat label={t('logs.info.cost')} value={st.cost ? formatCost(st.cost) : null} sub={st.turns ? tp('logs.info.turns', st.turns) : null} />
        <Stat label={t('logs.info.model')} value={st.model ?? settings.model} sub={settings.runner ? t('logs.info.runner', { runner: settings.runner }) : null} />
        {node?.type === 'action' && <Stat label={t('logs.info.exit-code')} value={st.exitCode ?? null} />}
        {st.attempts > 1 && <Stat label={t('logs.info.attempts')} value={st.attempts} />}
        {st.loop ? <Stat label={t('logs.info.loop')} value={t('logs.info.loop-value', { n: st.loop })} /> : null}
      </div>
      <div className="subhead">{t('logs.history.title')}</div>
      {history.length === 0 ? <div className="empty">{t('logs.history.empty')}</div> : (
        <table className="table">
          <thead><tr><th>#</th><th>{t('logs.info.status')}</th><th>{t('logs.info.started')}</th><th>{t('logs.info.duration')}</th><th>{t('logs.info.tokens')}</th><th>{t('logs.info.cost')}</th><th>{t('logs.history.files')}</th><th>{t('logs.history.result')}</th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td>{i + 1}{h.loop ? ` ${t('logs.history.loop', { n: h.loop })}` : ''}</td>
                <td><span className={`pill pill-${h.status}`}>{statusLabel(t, h.status)}</span></td>
                <td>{formatTime(intl, h.startedAt)}</td>
                <td>{formatDuration(t, h.durationMs)}</td>
                <td>{h.usage ? formatTokens(t, totalTokens(h.usage)) : '–'}</td>
                <td>{h.cost ? formatCost(h.cost) : '–'}</td>
                <td>{h.changes || '–'}</td>
                <td>{typeof h.verdict === 'boolean' ? (h.verdict ? 'PASS' : 'FAIL') : h.error ? <span className="err">{nodeErrorText(t, h)}</span> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function FilesTab({ st, git }) {
  const { t, tp } = useI18n();
  const [file, setFile] = useState(null);
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(false);
  const changes = st.changes ?? [];
  useEffect(() => { setFile(null); setDiff(''); }, [st.diff?.head]);
  const open = async (path) => {
    setFile(path);
    setLoading(true);
    try {
      setDiff((await api.diff(st.diff.base, st.diff.head, path ?? undefined)).diff);
    } catch (err) {
      setDiff(t('logs.files.diff-error', { message: errorMessage(t, err) }));
    } finally {
      setLoading(false);
    }
  };
  if (!changes.length && st.touched?.length) {
    return (
      <div className="files-tab">
        <div className="muted small">{git ? t('logs.files.no-git-changes') : t('logs.files.not-repo')} {t('logs.files.written')}</div>
        {st.touched.map((f) => <div key={f} className="file-row"><FilePen size={14} /> {f}</div>)}
      </div>
    );
  }
  if (!changes.length) {
    return <div className="empty">{st.status === 'running' ? t('logs.files.computed-later') : t('logs.files.none')}</div>;
  }
  const adds = changes.reduce((a, c) => a + (c.additions ?? 0), 0);
  const dels = changes.reduce((a, c) => a + (c.deletions ?? 0), 0);
  return (
    <div className="files-tab split">
      <div className="file-list">
        <div className="file-summary">
          {tp('logs.files.summary', changes.length)} · <span className="add">+{adds}</span> <span className="del">−{dels}</span>
          <button type="button" className="btn btn-xs" onClick={() => open(null)}>{t('logs.files.all-diff')}</button>
        </div>
        {changes.map((c) => {
          const Icon = FILE_ICON[c.status] ?? FilePen;
          return (
            <button type="button" key={c.path} className={`file-row ${file === c.path ? 'active' : ''}`} onClick={() => open(c.path)}>
              <Icon size={14} className={`fs-${c.status}`} />
              <span className="file-path">{c.from ? `${c.from} → ` : ''}{c.path}</span>
              <span className="add">+{c.additions ?? 0}</span><span className="del">−{c.deletions ?? 0}</span>
            </button>
          );
        })}
      </div>
      <div className="file-diff">
        {file === null && !diff && !loading && <div className="empty"><FileDiff size={16} /> {t('logs.files.pick')}</div>}
        {loading ? <div className="empty">{t('logs.files.loading')}</div> : diff && <DiffView text={diff} />}
      </div>
    </div>
  );
}

export function CommandTab({ st, node }) {
  const { t } = useI18n();
  if (!st.command) {
    return <div className="empty">{node?.type === 'agent' || node?.type === 'skill' || node?.type === 'action' ? t('logs.command.appears') : t('logs.command.none')}</div>;
  }
  return (
    <div className="cmd-tab">
      <div className="subhead">{node?.type === 'action' ? t('logs.command.title-shell') : t('logs.command.title-cli')} <CopyBtn text={st.command} /></div>
      <pre className="code-block">{st.command}</pre>
      {st.prompt && (
        <p className="muted small">
          {t('logs.command.prompt-note')}
        </p>
      )}
    </div>
  );
}

