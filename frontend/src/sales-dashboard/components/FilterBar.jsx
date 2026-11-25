import { useEffect, useRef, useState } from 'react';
import { useFilters } from '../FilterContext.jsx';
import { addDaysISO } from './dateutil.js';

function MultiSelect({ label, options, value, onChange, allLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const toggle = (o) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  const summary = value.length === 0 ? allLabel : value.length === 1 ? value[0] : `${value.length} selected`;
  return (
    <div className="sd-field" ref={ref}>
      <label>{label}</label>
      <button type="button" className="sd-select-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{summary}</span><span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="sd-popover">
          {options.map((o) => (
            <label key={o} className="sd-check">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
          {value.length > 0 && <button type="button" className="sd-link" onClick={() => onChange([])}>Clear</button>}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ showClosers = false }) {
  const { meta, filters, setFilters } = useFilters();
  if (!meta) return null;
  const today = meta.asOf;
  const y = today.slice(0, 4);

  const presets = [
    ['All time', '', ''],
    ['Last 30 days', addDaysISO(today, -29), today],
    ['Last 90 days', addDaysISO(today, -89), today],
    ['This month', `${today.slice(0, 7)}-01`, today],
    ['This year', `${y}-01-01`, today],
    ['Last year', `${Number(y) - 1}-01-01`, `${Number(y) - 1}-12-31`],
  ];
  const active = presets.find(([, f, t]) => f === filters.from && t === filters.to)?.[0];

  return (
    <div className="sd-filters">
      <div className="sd-field">
        <label htmlFor="from">Date range</label>
        <div className="sd-range">
          <input id="from" type="date" value={filters.from} min={meta.minDate || undefined} max={filters.to || today}
            onChange={(e) => setFilters({ from: e.target.value })} />
          <span>to</span>
          <input type="date" aria-label="To date" value={filters.to} min={filters.from || meta.minDate || undefined} max={today}
            onChange={(e) => setFilters({ to: e.target.value })} />
        </div>
      </div>
      <div className="sd-presets">
        {presets.map(([name, f, t]) => (
          <button key={name} type="button" className={active === name ? 'sd-on' : ''} onClick={() => setFilters({ from: f, to: t })}>{name}</button>
        ))}
      </div>
      <MultiSelect label="Program" allLabel="All programs" options={meta.programs} value={filters.programs}
        onChange={(programs) => setFilters({ programs })} />
      {showClosers && (
        <MultiSelect label="Closed By" allLabel="All closers" options={meta.closers} value={filters.closers}
          onChange={(closers) => setFilters({ closers })} />
      )}
    </div>
  );
}
