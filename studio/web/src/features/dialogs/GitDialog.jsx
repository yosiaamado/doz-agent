// GitHub synchronization: pull (rebase + autostash), commit every change, push to upstream. Never a force push.
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CloudDownload, CloudUpload, GitBranch, GitCommitHorizontal, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const TARGETS = [
  { value: 'repo', label: 'dialogs.git.target.repo' },
  { value: 'workdir', label: 'dialogs.git.target.workdir' },
];
const ACTION_LABEL = {
  fetch: 'dialogs.git.action.fetch', pull: 'dialogs.git.action.pull', push: 'dialogs.git.action.push', commit: 'dialogs.git.action.commit',
};
const STATUS_CLASS = { added: 'fs-added', untracked: 'fs-added', deleted: 'fs-deleted', conflict: 'fs-deleted' };
const STATUS_SHORT = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', copied: 'C', untracked: 'U', conflict: '!' };

function Summary({ status }) {
  const { t, tp } = useI18n();
  return (
    <div className="git-summary">
      <div className="git-branch"><GitBranch size={15} /> <strong>{status.branch}</strong>{status.upstream ? <span className="muted"> → {status.upstream}</span> : <span className="muted"> {t('dialogs.git.no-upstream')}</span>}</div>
      <div className="git-counts">
        <span title={t('dialogs.git.ahead-title')}><ArrowUp size={13} /> {status.ahead}</span>
        <span title={t('dialogs.git.behind-title')}><ArrowDown size={13} /> {status.behind}</span>
        <span>{tp('dialogs.git.files-changed', status.files.length)}</span>
      </div>
      {status.remote && <div className="muted small mono">{status.remote}</div>}
      {status.lastCommit && <div className="muted small">{t('dialogs.git.last-commit', { commit: status.lastCommit })}</div>}
    </div>
  );
}

export default function GitDialog({ onClose, onSynced }) {
  const { t, tp } = useI18n();
  const [target, setTarget] = useState('repo');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');
  const [output, setOutput] = useState('');
  const dialog = useDialog();
  const notify = useToast();

  const load = useCallback(async () => {
    setStatus(null);
    try {
      setStatus(await api.gitStatus(target));
    } catch (err) {
      setOutput(errorMessage(t, err));
    }
  }, [target, t]);
  useEffect(() => { load(); }, [load]);

  const run = async (action, body) => {
    const label = t(ACTION_LABEL[action]);
    setBusy(action);
    try {
      const res = await api.gitAction(target, action, body);
      setStatus(res.status);
      setOutput(res.output || t('dialogs.git.finished', { action: label }));
      notify(t('dialogs.git.succeeded', { action: label }), 'success');
      if (action === 'pull' || action === 'commit') onSynced?.(target);
      return true;
    } catch (err) {
      setOutput(errorWithDetails(t, err, '\n'));
      notify(t('dialogs.git.failed', { action: label }), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    const ok = await dialog.confirm({
      title: t('dialogs.git.push-title'), confirmLabel: t('dialogs.git.action.push'),
      message: status.ahead
        ? tp('dialogs.git.push-message', status.ahead, { branch: status.branch, upstream: status.upstream ?? `origin/${status.branch}` })
        : t('dialogs.git.push-message-all', { branch: status.branch, upstream: status.upstream ?? `origin/${status.branch}` }),
    });
    if (ok) await run('push', null);
  };

  const commit = async (andPush) => {
    if (!(await run('commit', { message }))) return;
    setMessage('');
    if (andPush) await run('push', null);
  };

  const ready = status?.isRepo;
  const changes = status?.files ?? [];
  const spin = (action, Icon) => (busy === action ? <Loader2 size={14} className="spin" /> : <Icon size={14} />);
  return (
    <Modal
      size="lg" title={t('dialogs.git.title')} icon={<GitBranch size={18} />} onClose={onClose}
      subtitle={t('dialogs.git.subtitle')}
      headerExtra={<Segmented value={target} onChange={setTarget} options={TARGETS.map((x) => ({ ...x, label: t(x.label) }))} ariaLabel={t('dialogs.git.repo-aria')} />}
      footer={ready && (
        <>
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run('fetch', null)}>{spin('fetch', RefreshCw)} {t('dialogs.git.check')}</button>
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run('pull', null)}>{spin('pull', CloudDownload)} {t('dialogs.git.action.pull')}{status.behind ? ` (${status.behind})` : ''}</button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" disabled={Boolean(busy) || (!status.ahead && status.upstream)} onClick={push}>{spin('push', CloudUpload)} {t('dialogs.git.action.push')}{status.ahead ? ` (${status.ahead})` : ''}</button>
        </>
      )}
    >
      {!status && <div className="empty pad"><Loader2 size={16} className="spin" /> {t('dialogs.git.reading')}</div>}
      {status && !ready && <div className="empty pad">{t('dialogs.git.not-repo', { path: status.path })}</div>}
      {ready && (
        <>
          <Summary status={status} />
          <div className="git-files">
            {changes.length === 0 && <div className="muted small">{t('dialogs.git.no-changes')}</div>}
            {changes.map((f) => (
              <div key={f.path} className="file-row" title={f.status}>
                <span className={`git-code ${STATUS_CLASS[f.status] ?? 'fs-modified'}`}>{STATUS_SHORT[f.status] ?? 'M'}</span>
                <span className="file-path">{f.path}</span>
              </div>
            ))}
          </div>
          {changes.length > 0 && (
            <>
              <Field label={t('dialogs.git.commit-message')} hint={t('dialogs.git.commit-hint')}>
                <textarea rows={2} value={message} placeholder={t('dialogs.git.commit-placeholder')} onChange={(e) => setMessage(e.target.value)} />
              </Field>
              <div className="git-commit-actions">
                <button type="button" className="btn" disabled={!message.trim() || Boolean(busy)} onClick={() => commit(false)}>{spin('commit', GitCommitHorizontal)} {t('dialogs.git.action.commit')}</button>
                <button type="button" className="btn btn-primary" disabled={!message.trim() || Boolean(busy)} onClick={() => commit(true)}><CloudUpload size={14} /> {t('dialogs.git.commit-push')}</button>
              </div>
            </>
          )}
        </>
      )}
      {output && <pre className="code-block git-output">{output}</pre>}
    </Modal>
  );
}
