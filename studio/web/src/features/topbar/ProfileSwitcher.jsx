import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Settings2, UserRound } from 'lucide-react';
import { usePopover } from '../../components/ui/usePopover.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage } from '../../lib/errorMessage.js';

export default function ProfileSwitcher({ profiles, activeProfileId, onSwitch, onManage }) {
  const { t } = useI18n();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const style = usePopover(btnRef, open, { minWidth: 240, maxHeight: 360 });
  useClickOutside([btnRef, popRef], () => setOpen(false), open);

  const active = profiles.find((p) => p.id === activeProfileId);
  const close = () => { setOpen(false); btnRef.current?.focus(); };
  const choose = async (id) => {
    close();
    if (id === activeProfileId) return;
    setBusy(true);
    try {
      await onSwitch(id);
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const manage = () => { setOpen(false); onManage(); };
  const onKeyDown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  return (
    <>
      <button
        ref={btnRef} type="button" className="btn btn-ghost profile-btn" aria-haspopup="menu" aria-expanded={open} disabled={busy}
        title={t('profiles.switcher.title')} aria-label={t('profiles.switcher.aria', { name: active?.name ?? '' })} onClick={() => setOpen((o) => !o)}
      >
        <UserRound size={15} />
        <span className="profile-name">{active?.name ?? t('common.loading')}</span>
        <ChevronDown size={14} className="select-chevron" />
      </button>
      {open && style && createPortal(
        <div ref={popRef} className="popover" style={style} role="menu" aria-label={t('profiles.switcher.title')} onKeyDown={onKeyDown}>
          <div className="popover-list">
            {profiles.map((p) => (
              <button
                key={p.id} type="button" role="menuitemradio" aria-checked={p.id === activeProfileId} className="option"
                autoFocus={p.id === activeProfileId} onClick={() => choose(p.id)}
              >
                <span className="option-text">
                  <span className="option-label">{p.name}</span>
                  <span className="option-desc">{p.configDir ?? t('profiles.dir-default')}</span>
                </span>
                {p.id === activeProfileId && <Check size={15} className="option-check" aria-hidden="true" />}
              </button>
            ))}
            <div className="option-sep" role="separator" />
            <button type="button" role="menuitem" className="option profile-manage" onClick={manage}>
              <Settings2 size={15} /> <span className="option-label">{t('profiles.switcher.manage')}</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
