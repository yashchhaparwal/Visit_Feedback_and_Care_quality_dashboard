import { fmt } from '../lib/format.js';
import { AlertIcon, ArrowDown, ArrowUp, CheckIcon } from './icons.jsx';

function Delta({ current, previous, dp = 2, label = 'vs previous period' }) {
  if (current === null || previous === null || current === undefined || previous === undefined) {
    return <span className="kpi-sub">No earlier data to compare</span>;
  }
  const d = current - previous;
  if (Math.abs(d) < 10 ** -dp / 2) return <span className="kpi-sub">No change {label}</span>;
  const up = d > 0;
  return (
    <span className="kpi-sub">
      <span className={up ? 'delta-up' : 'delta-down'}>
        {up ? <ArrowUp /> : <ArrowDown />} {Math.abs(d).toFixed(dp)}
      </span>{' '}
      {label}
    </span>
  );
}

export default function KpiTiles({ data }) {
  const c = data.current;
  const total = c.promoters + c.passives + c.detractors || 1;
  const rr = data.responseRate;
  return (
    <div className="grid kpis">
      <section className="card kpi" aria-label="Average rating">
        <span className="kpi-label">Average rating</span>
        <span className="kpi-value tabular">{fmt(c.overall)}<small> / 5</small></span>
        <Delta current={c.overall} previous={data.previous.overall} />
      </section>

      <section className="card kpi" aria-label="Net Promoter Score">
        <span className="kpi-label" title="% promoters (9-10) minus % detractors (0-6)">Net Promoter Score</span>
        <span className="kpi-value tabular">{c.nps ?? '–'}</span>
        <Delta current={c.nps} previous={data.previous.nps} dp={0} />
        <div className="nps-bar" role="img" aria-label={`${c.promoters} promoters, ${c.passives} passives, ${c.detractors} detractors`}>
          <span style={{ width: `${(c.promoters / total) * 100}%`, background: 'var(--good)' }} />
          <span style={{ width: `${(c.passives / total) * 100}%`, background: 'var(--axis)' }} />
          <span style={{ width: `${(c.detractors / total) * 100}%`, background: 'var(--critical)' }} />
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--good)' }} />Promoters {c.promoters}</span>
          <span><i style={{ background: 'var(--axis)' }} />Passive {c.passives}</span>
          <span><i style={{ background: 'var(--critical)' }} />Detractors {c.detractors}</span>
        </div>
      </section>

      <section className="card kpi" aria-label="Responses">
        <span className="kpi-label">Responses</span>
        <span className="kpi-value tabular">{c.responses}</span>
        <span className="kpi-sub">
          {rr.rate === null ? 'No links sent in this period' : `${Math.round(rr.rate * 100)}% response rate (${rr.answered} of ${rr.sent} links)`}
        </span>
      </section>

      <section className="card kpi" aria-label="Open follow-ups">
        <span className="kpi-label">
          {data.openFollowUps > 0 ? <AlertIcon size={14} style={{ color: 'var(--critical)' }} /> : <CheckIcon size={14} style={{ color: 'var(--good)' }} />}
          Open follow-ups
        </span>
        <span className="kpi-value tabular">{data.openFollowUps}</span>
        <span className="kpi-sub">
          {data.openFollowUps > 0 ? 'Low scores waiting for a call' : 'All low scores handled'} · {c.lowScores} low in period
        </span>
      </section>
    </div>
  );
}
