// Dropdown modern yang bisa dipakai dengan keyboard (↑ ↓ Enter Esc) dan punya pencarian kalau opsinya banyak.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { usePopover } from './usePopover.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';

function matches(option, q) {
  return !q || `${option.label} ${option.description ?? ''}`.toLowerCase().includes(q.toLowerCase());
}

export default function Select({
  value, onChange, options, placeholder = 'Pilih…', searchable, variant = 'default', actions = [], ariaLabel, className = '', renderValue,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const listId = useId();
  const style = usePopover(triggerRef, open);
  const showSearch = searchable ?? options.length > 8;
  const visible = useMemo(() => options.filter((o) => matches(o, query)), [options, query]);
  const items = useMemo(() => [...visible.map((o) => ({ ...o, kind: 'option' })), ...actions.map((a) => ({ ...a, kind: 'action' }))], [visible, actions]);
  const selected = options.find((o) => o.value === value);

  useClickOutside([triggerRef, popRef], () => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const choose = (item) => {
    if (!item) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (item.kind === 'action') item.onSelect();
    else onChange(item.value);
  };

  const onKeyDown = (e) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  let lastGroup = null;
  return (
    <div className={`select ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef} type="button" className={`select-trigger ${variant}`} aria-haspopup="listbox"
        aria-expanded={open} aria-controls={listId} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}
      >
        {selected?.icon}
        <span className={`select-value ${selected ? '' : 'select-placeholder'}`}>
          {renderValue ? renderValue(selected) : selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} className="select-chevron" />
      </button>
      {open && style && createPortal(
        <div ref={popRef} className="popover" style={style}>
          {showSearch && (
            <div className="popover-search">
              <Search size={14} />
              <input autoFocus value={query} placeholder="Cari…" onChange={(e) => { setQuery(e.target.value); setActive(0); }} />
            </div>
          )}
          <div className="popover-list" role="listbox" id={listId}>
            {items.length === 0 && <div className="empty pad">Tidak ada yang cocok</div>}
            {items.map((item, i) => {
              const header = item.kind === 'option' && item.group && item.group !== lastGroup ? item.group : null;
              if (item.kind === 'option') lastGroup = item.group ?? lastGroup;
              const sep = item.kind === 'action' && i === visible.length && visible.length > 0;
              return (
                <div key={`${item.kind}-${item.value ?? item.label}`}>
                  {header && <div className="option-group">{header}</div>}
                  {sep && <div className="option-sep" />}
                  <button
                    type="button" role="option" className="option" aria-selected={item.kind === 'option' && item.value === value}
                    data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(item)}
                  >
                    {item.icon}
                    <span className="option-text">
                      <span className="option-label">{item.label}</span>
                      {item.description && <span className="option-desc">{item.description}</span>}
                    </span>
                    {item.kind === 'option' && item.value === value && <Check size={14} className="option-check" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
