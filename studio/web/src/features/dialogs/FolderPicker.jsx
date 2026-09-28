// Pemilih folder ala file manager (dijelajahi lewat server, karena browser tidak memberi path absolut).
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, HardDrive, Home, ArrowUp } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { api } from '../../lib/api.js';

const ROOT_ICON = { Home: Home, 'Project aktif': FolderOpen, 'Repo doz-agent': FolderOpen };

function Breadcrumbs({ listing, onOpen }) {
  const sep = listing.path.includes('\\') ? '\\' : '/';
  const absolute = listing.path.startsWith('/');
  return (
    <div className="crumbs">
      {listing.segments.map((seg, i) => {
        const target = `${absolute ? sep : ''}${listing.segments.slice(0, i + 1).join(sep)}${!absolute && i === 0 ? sep : ''}`;
        return (
          <span key={target} style={{ display: 'contents' }}>
            {i > 0 && <ChevronRight size={13} className="muted" />}
            <button type="button" className="crumb" onClick={() => onOpen(target)}>{seg}</button>
          </span>
        );
      })}
    </div>
  );
}

export default function FolderPicker({ title = 'Pilih Folder', initialPath, confirmLabel = 'Pilih Folder Ini', onPick, onClose }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const open = useCallback(async (path) => {
    try {
      setListing(await api.folders(path));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { open(initialPath); }, [open, initialPath]);

  return (
    <Modal
      size="lg" title={title} subtitle={listing ? `Terpilih: ${listing.name}` : 'Memuat…'} onClose={onClose}
      footer={(
        <>
          {listing?.markers.length > 0 && <span className="picker-markers">{listing.markers.map((m) => <span key={m} className="tag">{m}</span>)}</span>}
          {error && <span className="err small">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary" disabled={!listing} onClick={() => onPick(listing)}>{confirmLabel}</button>
        </>
      )}
    >
      {listing && (
        <div className="picker">
          <div className="picker-roots">
            {listing.roots.map((r) => {
              const Icon = ROOT_ICON[r.label] ?? HardDrive;
              return <button key={`${r.label}-${r.path}`} type="button" className="picker-root" onClick={() => open(r.path)}><Icon size={15} /> {r.label}</button>;
            })}
          </div>
          <div className="picker-main">
            <Breadcrumbs listing={listing} onOpen={open} />
            <div className="picker-list">
              {listing.parent && <button type="button" className="picker-item" onClick={() => open(listing.parent)}><ArrowUp size={15} /> ..</button>}
              {listing.folders.length === 0 && <div className="empty pad">Tidak ada subfolder.</div>}
              {listing.folders.map((f) => (
                <button key={f.path} type="button" className="picker-item" onDoubleClick={() => open(f.path)} onClick={() => open(f.path)}>
                  <Folder size={16} /> {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
