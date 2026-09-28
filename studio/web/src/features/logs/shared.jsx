import { useState } from 'react';
import { Copy, FilePlus2, FileMinus2, FilePen } from 'lucide-react';

export const STATUS_TEXT = {
  running: 'Berjalan', done: 'Sukses', failed: 'Gagal', skipped: 'Dilewati', waiting: 'Butuh keputusan', stopped: 'Dihentikan', pending: 'Menunggu',
};
export const FILE_ICON = { added: FilePlus2, deleted: FileMinus2, modified: FilePen, renamed: FilePen };
export const KIND_CLASS = { tool: 'k-tool', text: 'k-text', status: 'k-status', tool_error: 'k-err', retry: 'k-err', init: 'k-muted' };

export function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-xs" onClick={() => { copy(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      <Copy size={12} /> {done ? 'Tersalin' : 'Salin'}
    </button>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value || '–'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

