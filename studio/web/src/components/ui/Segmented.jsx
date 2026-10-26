export default function Segmented({ value, onChange, options, ariaLabel }) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel} style={{ '--n': options.length, '--i': Math.max(0, options.findIndex((o) => o.value === value)) }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''}
          title={o.title} onClick={() => onChange(o.value)}>
          {o.icon}{o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
