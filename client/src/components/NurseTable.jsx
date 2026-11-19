import { useMemo, useState } from 'react';
import { CATEGORIES, fmt } from '../lib/format.js';
import { ArrowDown, ArrowUp } from './icons.jsx';

/** Tiny weekly trend line. Fixed 2.5-5 scale so lines are comparable across nurses. */
function Sparkline({ points, name }) {
  if (points.length < 2) return <span className="subtle">–</span>;
  const w = 96;
  const h = 26;
  const lo = 2.5;
  const hi = 5;
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * (w - 4) + 2,
    h - 2 - ((Math.min(hi, Math.max(lo, p.overall)) - lo) / (hi - lo)) * (h - 4),
  ]);
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} role="img" aria-label={`${name}: weekly average from ${fmt(points[0].overall)} to ${fmt(points[points.length - 1].overall)}`}>
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--series-1)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--series-1)" />
    </svg>
  );
}

function Change({ value }) {
  if (value === null) return <span className="subtle">–</span>;
  if (Math.abs(value) < 0.1) return <span className="muted tabular">±{fmt(Math.abs(value))}</span>;
  return (
    <span className={`tabular ${value > 0 ? 'delta-up' : 'delta-down'}`}>
      {value > 0 ? <ArrowUp /> : <ArrowDown />} {fmt(Math.abs(value))}
    </span>
  );
}

const COLUMNS = [
  { key: 'name', label: 'Nurse', align: 'left' },
  { key: 'responses', label: 'Responses' },
  { key: 'overall', label: 'Avg' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.short, title: c.label, category: true })),
  { key: 'nps', label: 'NPS' },
  { key: 'change', label: '4-wk change', title: 'Last 4 weeks vs the 4 before' },
  { key: 'weekly', label: 'Trend', sortable: false },
  { key: 'openFollowUps', label: 'Open' , title: 'Open follow-ups' },
];

export default function NurseTable({ nurses, selectedId, onSelect }) {
  const [sort, setSort] = useState({ key: 'overall', dir: 'asc' });

  const rows = useMemo(() => {
    const get = (n) => (CATEGORIES.some((c) => c.key === sort.key) ? n.categories[sort.key] : n[sort.key]);
    return [...nurses].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [nurses, sort]);

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Average rating per nurse</h2>
        <span className="subtle">Click a nurse to filter the dashboard. Low values in red.</span>
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="data">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={c.align === 'left' ? '' : 'num'}
                  title={c.title}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <button type="button" onClick={() => toggle(c.key)}>
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp /> : <ArrowDown />)}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr
                key={n.id}
                className={`clickable ${selectedId === n.id ? 'selected' : ''}`}
                onClick={() => onSelect(selectedId === n.id ? '' : n.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(selectedId === n.id ? '' : n.id))}
                tabIndex={0}
                aria-selected={selectedId === n.id}
              >
                <td>
                  <div className="cell-strong">{n.name}</div>
                  <div className="subtle">{n.specialization} · {n.city}</div>
                </td>
                <td className="num">{n.responses}</td>
                <td className={`num ${n.overall < 3.8 ? 'score-low' : 'cell-strong'}`}>{fmt(n.overall)}</td>
                {CATEGORIES.map((c) => (
                  <td key={c.key} className={`num ${n.categories[c.key] < 3.5 ? 'score-low' : ''}`}>{fmt(n.categories[c.key], 1)}</td>
                ))}
                <td className={`num ${n.nps < 0 ? 'score-low' : ''}`}>{n.nps}</td>
                <td className="num"><Change value={n.change} /></td>
                <td className="num"><Sparkline points={n.weekly} name={n.name} /></td>
                <td className="num">
                  {n.openFollowUps > 0 ? <span className="chip chip-critical">{n.openFollowUps}</span> : <span className="subtle">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
