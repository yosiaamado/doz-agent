// A file-manager-style folder picker (browsed through the server, because the browser does not expose absolute paths).
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, HardDrive, Home, ArrowUp } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { api } from '../../lib/api.js';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// Shortcuts are recognized through a stable `id` from the server; `label` is only the English fallback (and the drive name for id 'drive').
const ROOT_ICON = { home: Home, workdir: FolderOpen, repo: FolderOpen };
const ROOT_LABEL = { home: 'dialogs.folder.root.home', workdir: 'dialogs.folder.root.project', repo: 'dialogs.folder.root.repo' };

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

export default function FolderPicker({ title, initialPath, confirmLabel, onPick, onClose }) {
  const { t } = useI18n();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const open = useCallback(async (path) => {
    try {
      setListing(await api.folders(path));
      setError(null);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }, [t]);
  useEffect(() => { open(initialPath); }, [open, initialPath]);

  return (
    <Modal
      size="lg" title={title ?? t('dialogs.folder.title')} subtitle={listing ? t('dialogs.folder.selected', { name: listing.name }) : t('common.loading')} onClose={onClose}
      footer={(
        <>
          {listing?.markers.length > 0 && <span className="picker-markers">{listing.markers.map((m) => <span key={m} className="tag">{m}</span>)}</span>}
          {error && <span className="err small">{error}</span>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!listing} onClick={() => onPick(listing)}>{confirmLabel ?? t('dialogs.folder.confirm')}</button>
        </>
      )}
    >
      {listing && (
        <div className="picker">
          <div className="picker-roots">
            {listing.roots.map((r) => {
              const Icon = ROOT_ICON[r.id] ?? HardDrive;
              return <button key={`${r.id}-${r.path}`} type="button" className="picker-root" onClick={() => open(r.path)}><Icon size={15} /> {Object.hasOwn(ROOT_LABEL, r.id) ? t(ROOT_LABEL[r.id]) : r.label}</button>;
            })}
          </div>
          <div className="picker-main">
            <Breadcrumbs listing={listing} onOpen={open} />
            <div className="picker-list">
              {listing.parent && <button type="button" className="picker-item" onClick={() => open(listing.parent)}><ArrowUp size={15} /> ..</button>}
              {listing.folders.length === 0 && <div className="empty pad">{t('dialogs.folder.empty')}</div>}
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
