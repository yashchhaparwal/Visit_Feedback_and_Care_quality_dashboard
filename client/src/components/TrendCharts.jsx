import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORIES, fmt, formatShortDate } from '../lib/format.js';

const axisProps = {
  tick: { fill: 'var(--axis)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--grid)' },
};

function TooltipBox({ active, payload, valueLabel, format }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>Week of {formatShortDate(p.weekStart)}</strong>
      {valueLabel}: <b className="tabular">{format(payload[0].value)}</b>
      <div className="subtle">{p.responses} response{p.responses === 1 ? '' : 's'}</div>
    </div>
  );
}

/** Two single-measure charts side by side (never a dual axis): average rating and NPS per week. */
export default function TrendCharts({ data, title }) {
  if (!data.length) {
    return <div className="card empty">No responses in this period yet.</div>;
  }
  const minOverall = Math.min(...data.map((d) => d.overall));
  const ratingFloor = Math.max(1, Math.floor((minOverall - 0.25) * 2) / 2);

  return (
    <div className="grid two-col">
      <section className="card">
        <div className="card-head">
          <h2>Average rating by week</h2>
          <span className="subtle">{title}</span>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="weekStart" tickFormatter={formatShortDate} minTickGap={24} {...axisProps} />
              <YAxis domain={[ratingFloor, 5]} tickCount={5} width={36} tickFormatter={(v) => v.toFixed(1)} {...axisProps} axisLine={false} />
              <Tooltip content={<TooltipBox valueLabel="Avg rating" format={(v) => `${fmt(v)} / 5`} />} cursor={{ stroke: 'var(--axis)', strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey="overall" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-1)', strokeWidth: 0 }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>NPS by week</h2>
          <span className="subtle">-100 to +100</span>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="weekStart" tickFormatter={formatShortDate} minTickGap={24} {...axisProps} />
              <YAxis domain={[(min) => Math.min(0, Math.floor(min / 20) * 20), 100]} width={36} {...axisProps} axisLine={false} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <Tooltip content={<TooltipBox valueLabel="NPS" format={(v) => (v > 0 ? `+${v}` : v)} />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="nps" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

/** Horizontal bars for the four category averages. Text values sit beside each bar. */
export function CategoryBars({ categories }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>By category</h2>
        <span className="subtle">avg out of 5</span>
      </div>
      <div className="card-pad" style={{ paddingTop: 8 }}>
        {CATEGORIES.map((c) => {
          const v = categories[c.key];
          return (
            <div className="bar-row" key={c.key}>
              <span>{c.label}</span>
              <div className="bar-track" role="img" aria-label={`${c.label} ${fmt(v)} out of 5`}>
                <div className="bar-fill" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
              </div>
              <span className="num cell-strong">{fmt(v)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
