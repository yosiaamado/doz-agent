import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, FileDiff, FilePlus2, FileMinus2, FilePen, Square } from 'lucide-react';
import { api } from '../api.js';
import { useNow } from '../context.js';
import { TypeIcon, StatusIcon } from '../icons.jsx';
import DiffView from './DiffView.jsx';
import {
  NODE_META, formatCost, formatDuration, formatTime, formatTokens, runTokens, totalTokens,
} from '../model.js';

const STATUS_TEXT = {
  running: 'Berjalan', done: 'Sukses', failed: 'Gagal', skipped: 'Dilewati', waiting: 'Butuh keputusan', stopped: 'Dihentikan', pending: 'Menunggu',
};
const FILE_ICON = { added: FilePlus2, deleted: FileMinus2, modified: FilePen, renamed: FilePen };
const KIND_CLASS = { tool: 'k-tool', text: 'k-text', status: 'k-status', tool_error: 'k-err', retry: 'k-err', init: 'k-muted' };

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-xs" onClick={() => { copy(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      <Copy size={12} /> {done ? 'Tersalin' : 'Salin'}
    </button>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value || '–'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function InfoTab({ st, node }) {
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

function FilesTab({ st, git }) {
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

function CommandTab({ st, node }) {
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

function NodeDetail({ nodeId, node, st, log, git, label }) {
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

function RunSummary({ run }) {
  const now = useNow(run.status === 'running');
  const duration = run.startedAt ? (run.endedAt ?? now) - run.startedAt : null;
  return (
    <span className={`s-text s-${run.status}`}>
      {STATUS_TEXT[run.status] ?? run.status}{duration ? ` dalam ${formatDuration(duration)}` : ''}
      <span className="muted"> · {formatTokens(runTokens(run))} · {formatCost(run.cost)}</span>
    </span>
  );
}

export default function LogsPanel({ run, nodesById, selectedNode, onSelectNode, onStop, open, setOpen, git }) {
  const label = (id) => nodesById[id]?.label || nodesById[id]?.agent || nodesById[id]?.skill?.replace('doz-agent:', '') || NODE_META[nodesById[id]?.type]?.label || id;
  const order = run.order.filter((id) => nodesById[id]?.type !== 'info');
  return (
    <section className={`logs ${open ? 'open' : 'closed'}`}>
      <div className="logs-bar" onDoubleClick={() => setOpen(!open)}>
        <span className="logs-title">Logs</span>
        {run.id ? <RunSummary run={run} /> : <span className="muted">Belum ada run dipilih</span>}
        {run.source === 'claude-code' && <span className="tag">dari Claude Code</span>}
        <span className="spacer" />
        {run.status === 'running' && run.source === 'studio' && (
          <button type="button" className="btn btn-xs btn-no" onClick={onStop}><Square size={11} /> Stop</button>
        )}
        <button type="button" className="icon-btn" onClick={() => setOpen(!open)} title={open ? 'Kecilkan' : 'Buka'}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {open && (
        <div className="logs-body">
          <div className="tree">
            {!run.id && <div className="empty pad">Jalankan workflow atau pilih run di tab Executions. Run dari Claude Code (skill run-workflow) muncul otomatis.</div>}
            {run.error && <div className="tree-error">{run.error}</div>}
            {order.map((id) => {
              const st = run.nodes[id] ?? {};
              const tokens = (st.history ?? []).reduce((a, h) => a + totalTokens(h.usage), 0) + (st.status === 'running' ? totalTokens(st.usage) : 0);
              return (
                <button type="button" key={id} className={`tree-row ${selectedNode === id ? 'active' : ''}`} onClick={() => onSelectNode(id)}>
                  <StatusIcon status={st.status} />
                  <TypeIcon type={nodesById[id]?.type} size={14} />
                  <span className="tree-label">{label(id)}</span>
                  {st.history?.length > 1 && <span className="tag">{st.history.length}x</span>}
                  <span className="tree-meta">{tokens ? formatTokens(tokens) : ''}</span>
                </button>
              );
            })}
          </div>
          {selectedNode
            ? <NodeDetail nodeId={selectedNode} node={nodesById[selectedNode]} st={run.nodes[selectedNode]} log={run.log} git={git} label={label(selectedNode)} />
            : (
              <div className="detail">
                <div className="log run-log">
                  {run.log.map((l, i) => (
                    <div key={i} className={`log-line ${KIND_CLASS[l.kind] ?? ''}`}>
                      <span className="log-time">{formatTime(l.ts)}</span>
                      <span className="log-node">{l.node ? label(l.node) : 'run'}</span>
                      <span className="log-text">{l.text}</span>
                    </div>
                  ))}
                  {run.id && run.log.length === 0 && <div className="empty">Belum ada aktivitas.</div>}
                </div>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
