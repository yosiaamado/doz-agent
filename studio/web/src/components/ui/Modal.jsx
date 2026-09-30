// Modal dengan fokus terkelola: fokus pindah ke modal saat dibuka, kembali ke elemen asal saat ditutup, Esc menutup.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

export default function Modal({ title, subtitle, icon, iconTone, size = 'md', onClose, footer, children, headerExtra }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const first = ref.current?.querySelector('[autofocus], input, textarea, button.btn-primary');
    (first ?? ref.current)?.focus();
    return () => previous?.focus?.();
  }, []);
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={ref} className={`modal size-${size}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}
      >
        <div className="modal-head">
          {icon && <span className={`modal-icon ${iconTone ?? ''}`}>{icon}</span>}
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          {headerExtra}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
