// Input bebas dengan saran (mis. model: opus/sonnet/haiku atau id model lengkap).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { usePopover } from './usePopover.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

export default function Combobox({ value, onChange, suggestions, placeholder }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const style = usePopover(wrapRef, open, { minWidth: 160 });
  useClickOutside([wrapRef, popRef], () => setOpen(false), open);
  const pick = (v) => { onChange(v); setOpen(false); };
  return (
    <div className="combo" ref={wrapRef}>
      <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || undefined)} onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
      <button type="button" className="combo-btn" aria-label={t('common.show-options')} onClick={() => setOpen((o) => !o)}><ChevronDown size={14} /></button>
      {open && style && createPortal(
        <div ref={popRef} className="popover" style={style} role="listbox">
          <button type="button" className="option" onClick={() => pick(undefined)}><span className="option-text"><span className="option-label">{placeholder}</span></span></button>
          {suggestions.map((s) => (
            <button type="button" key={s.value} className="option" aria-selected={s.value === value} onClick={() => pick(s.value)}>
              <span className="option-text">
                <span className="option-label">{s.label ?? s.value}</span>
                {s.description && <span className="option-desc">{s.description}</span>}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
