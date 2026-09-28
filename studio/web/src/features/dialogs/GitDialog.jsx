// Sinkronisasi GitHub: pull (rebase + autostash), commit semua perubahan, push ke upstream. Tidak pernah force push.
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CloudDownload, CloudUpload, GitBranch, GitCommitHorizontal, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';

const TARGETS = [
  { value: 'repo', label: 'Repo doz-agent' },
  { value: 'workdir', label: 'Project Aktif' },
];
const STATUS_CLASS = { added: 'fs-added', untracked: 'fs-added', deleted: 'fs-deleted', conflict: 'fs-deleted' };
const STATUS_SHORT = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', copied: 'C', untracked: 'U', conflict: '!' };

function Summary({ status }) {
  return (
    <div className="git-summary">
      <div className="git-branch"><GitBranch size={15} /> <strong>{status.branch}</strong>{status.upstream ? <span className="muted"> → {status.upstream}</span> : <span className="muted"> (belum ada di remote)</span>}</div>
      <div className="git-counts">
        <span title="Commit lokal yang belum di-push"><ArrowUp size={13} /> {status.ahead}</span>
        <span title="Commit di GitHub yang belum di-pull"><ArrowDown size={13} /> {status.behind}</span>
        <span>{status.files.length} file berubah</span>
      </div>
      {status.remote && <div className="muted small mono">{status.remote}</div>}
      {status.lastCommit && <div className="muted small">Commit terakhir: {status.lastCommit}</div>}
    </div>
  );
}

export default function GitDialog({ onClose, onSynced }) {
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
      setOutput(err.message);
    }
  }, [target]);
  useEffect(() => { load(); }, [load]);

  const run = async (action, body, label) => {
    setBusy(action);
    try {
      const res = await api.gitAction(target, action, body);
      setStatus(res.status);
      setOutput(res.output || `${label} selesai.`);
      notify(`${label} berhasil`, 'success');
      if (action === 'pull' || action === 'commit') onSynced?.(target);
      return true;
    } catch (err) {
      setOutput([err.message, ...(err.details ?? [])].join('\n'));
      notify(`${label} gagal`, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    const ok = await dialog.confirm({
      title: 'Push ke GitHub?', confirmLabel: 'Push',
      message: `${status.ahead || 'Semua'} commit di branch ${status.branch} akan dikirim ke ${status.upstream ?? `origin/${status.branch}`}.`,
    });
    if (ok) await run('push', null, 'Push');
  };

  const commit = async (andPush) => {
    if (!(await run('commit', { message }, 'Commit'))) return;
    setMessage('');
    if (andPush) await run('push', null, 'Push');
  };

  const ready = status?.isRepo;
  const changes = status?.files ?? [];
  const spin = (action, Icon) => (busy === action ? <Loader2 size={14} className="spin" /> : <Icon size={14} />);
  return (
    <Modal
      size="lg" title="Sinkronisasi GitHub" icon={<GitBranch size={18} />} onClose={onClose}
      subtitle="Memakai git dan kredensial GitHub di komputer ini. Pull memakai rebase + autostash, push tidak pernah force."
      headerExtra={<Segmented value={target} onChange={setTarget} options={TARGETS} ariaLabel="Repo" />}
      footer={ready && (
        <>
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run('fetch', null, 'Fetch')}>{spin('fetch', RefreshCw)} Cek GitHub</button>
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run('pull', null, 'Pull')}>{spin('pull', CloudDownload)} Pull{status.behind ? ` (${status.behind})` : ''}</button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" disabled={Boolean(busy) || (!status.ahead && status.upstream)} onClick={push}>{spin('push', CloudUpload)} Push{status.ahead ? ` (${status.ahead})` : ''}</button>
        </>
      )}
    >
      {!status && <div className="empty pad"><Loader2 size={16} className="spin" /> Membaca status git…</div>}
      {status && !ready && <div className="empty pad">Folder <code>{status.path}</code> bukan repo git. Jalankan <code>git init</code> dan tambahkan remote GitHub dulu.</div>}
      {ready && (
        <>
          <Summary status={status} />
          <div className="git-files">
            {changes.length === 0 && <div className="muted small">Tidak ada perubahan lokal.</div>}
            {changes.map((f) => (
              <div key={f.path} className="file-row" title={f.status}>
                <span className={`git-code ${STATUS_CLASS[f.status] ?? 'fs-modified'}`}>{STATUS_SHORT[f.status] ?? 'M'}</span>
                <span className="file-path">{f.path}</span>
              </div>
            ))}
          </div>
          {changes.length > 0 && (
            <>
              <Field label="Pesan Commit" hint="Semua perubahan di atas ikut di-commit.">
                <textarea rows={2} value={message} placeholder="mis. feat: tambah agent doc-writer" onChange={(e) => setMessage(e.target.value)} />
              </Field>
              <div className="git-commit-actions">
                <button type="button" className="btn" disabled={!message.trim() || Boolean(busy)} onClick={() => commit(false)}>{spin('commit', GitCommitHorizontal)} Commit</button>
                <button type="button" className="btn btn-primary" disabled={!message.trim() || Boolean(busy)} onClick={() => commit(true)}><CloudUpload size={14} /> Commit & Push</button>
              </div>
            </>
          )}
        </>
      )}
      {output && <pre className="code-block git-output">{output}</pre>}
    </Modal>
  );
}
