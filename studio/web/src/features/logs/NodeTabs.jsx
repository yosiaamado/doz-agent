import { useEffect, useState } from 'react';
import { FileDiff, FilePen } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useNow } from '../../hooks/useNow.js';
import DiffView from './DiffView.jsx';
import { STATUS_TEXT, FILE_ICON, CopyBtn, Stat } from './shared.jsx';
import { formatCost, formatDuration, formatTime, formatTokens, totalTokens } from '../../lib/model.js';

export function InfoTab({ st, node }) {
  const now = useNow(st.status === 'running');
  const duration = st.status === 'running' && st.startedAt ? now - st.startedAt : st.durationMs;
  const u = st.usage;
  const history = st.history ?? [];
  const settings = st.settings ?? {};
  return (
    <div className="info-tab">
      <div className="stats">
        <Stat label="Status" value={<span className={`pill pill-${st.status}`}>{STATUS_TEXT[st.status] ?? st.status}</span>} sub={st.warning || st.error} />
        <Stat label="Mulai" value={formatTime(st.startedAt)} sub={st.endedAt ? `selesai ${formatTime(st.endedAt)}` : null} />
        <Stat label="Durasi" value={formatDuration(duration)} sub={st.status === 'running' ? 'masih berjalan' : null} />
        <Stat label="Token" value={u ? formatTokens(totalTokens(u)) : null}
          sub={u ? `in ${u.input ?? 0} · out ${u.output ?? 0} · cache ${(u.cacheRead ?? 0) + (u.cacheWrite ?? 0)}` : null} />
        <Stat label="Biaya" value={st.cost ? formatCost(st.cost) : null} sub={st.turns ? `${st.turns} turns` : null} />
        <Stat label="Model" value={st.model ?? settings.model} sub={settings.runner ? `runner ${settings.runner}` : null} />
        {node?.type === 'action' && <Stat label="Exit code" value={st.exitCode ?? null} />}
        {st.attempts > 1 && <Stat label="Percobaan" value={st.attempts} />}
        {st.loop ? <Stat label="Loop" value={`ke-${st.loop}`} /> : null}
      </div>
      <div className="subhead">Riwayat eksekusi node ini</div>
      {history.length === 0 ? <div className="empty">Belum ada eksekusi selesai.</div> : (
        <table className="table">
          <thead><tr><th>#</th><th>Status</th><th>Mulai</th><th>Durasi</th><th>Token</th><th>Biaya</th><th>File</th><th>Hasil</th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td>{i + 1}{h.loop ? ` (loop ${h.loop})` : ''}</td>
                <td><span className={`pill pill-${h.status}`}>{STATUS_TEXT[h.status] ?? h.status}</span></td>
                <td>{formatTime(h.startedAt)}</td>
                <td>{formatDuration(h.durationMs)}</td>
                <td>{h.usage ? formatTokens(totalTokens(h.usage)) : '–'}</td>
                <td>{h.cost ? formatCost(h.cost) : '–'}</td>
                <td>{h.changes || '–'}</td>
                <td>{typeof h.verdict === 'boolean' ? (h.verdict ? 'PASS' : 'FAIL') : h.error ? <span className="err">{h.error}</span> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function FilesTab({ st, git }) {
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
      setDiff(`Gagal memuat diff: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  if (!changes.length && st.touched?.length) {
    return (
      <div className="files-tab">
        <div className="muted small">{git ? 'Tidak ada perubahan di snapshot git.' : 'Folder project bukan repo git, jadi diff tidak tersedia.'} File yang ditulis agent:</div>
        {st.touched.map((f) => <div key={f} className="file-row"><FilePen size={14} /> {f}</div>)}
      </div>
    );
  }
  if (!changes.length) {
    return <div className="empty">{st.status === 'running' ? 'Perubahan file dihitung setelah node selesai.' : 'Node ini tidak mengubah file.'}</div>;
  }
  const adds = changes.reduce((a, c) => a + (c.additions ?? 0), 0);
  const dels = changes.reduce((a, c) => a + (c.deletions ?? 0), 0);
  return (
    <div className="files-tab split">
      <div className="file-list">
        <div className="file-summary">
          {changes.length} file · <span className="add">+{adds}</span> <span className="del">−{dels}</span>
          <button type="button" className="btn btn-xs" onClick={() => open(null)}>Semua diff</button>
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
        {file === null && !diff && !loading && <div className="empty"><FileDiff size={16} /> Pilih file untuk melihat perbedaan lama dan baru.</div>}
        {loading ? <div className="empty">Memuat diff…</div> : diff && <DiffView text={diff} />}
      </div>
    </div>
  );
}

export function CommandTab({ st, node }) {
  if (!st.command) {
    return <div className="empty">{node?.type === 'agent' || node?.type === 'skill' || node?.type === 'action' ? 'Command muncul saat node mulai jalan.' : 'Node ini tidak menjalankan perintah.'}</div>;
  }
  return (
    <div className="cmd-tab">
      <div className="subhead">Perintah {node?.type === 'action' ? 'shell' : 'Claude Code CLI'} <CopyBtn text={st.command} /></div>
      <pre className="code-block">{st.command}</pre>
      {st.prompt && (
        <p className="muted small">
          <code>prompt.md</code> = isi tab Input. Output dibaca sebagai stream JSON supaya aktivitas tampil realtime.
        </p>
      )}
    </div>
  );
}

