import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { qs } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { RANGE_PRESETS, rangeParams } from '../lib/format.js';
import KpiTiles from '../components/KpiTiles.jsx';
import TrendCharts, { CategoryBars } from '../components/TrendCharts.jsx';
import NurseTable from '../components/NurseTable.jsx';
import FollowUpList from '../components/FollowUpList.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';

export default function DashboardPage() {
  // Filters live in the URL so a filtered view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const preset = params.get('range') || '90';
  const nurseId = params.get('nurse') ? Number(params.get('nurse')) : '';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
  };

  const range = useMemo(() => rangeParams(preset), [preset]);
  const scoped = qs({ ...range, nurseId });

  const overview = useApi(`/api/admin/stats/overview${scoped}`);
  const trend = useApi(`/api/admin/stats/trend${scoped}`);
  const nurses = useApi(`/api/admin/stats/nurses${qs(range)}`);
  const followUps = useApi('/api/admin/follow-ups?status=open');
  const nurseList = useApi('/api/admin/nurses');

  const selectedNurse = nurseList.data?.find((n) => n.id === nurseId);
  const visibleFollowUps = (followUps.data ?? []).filter((f) => !nurseId || f.nurse.id === nurseId);

  const refreshAfterResolve = () => {
    followUps.reload();
    overview.reload();
    nurses.reload();
  };

  const firstError = overview.error || trend.error || nurses.error || followUps.error;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Care quality</h1>
          <p className="muted">{selectedNurse ? `Showing ${selectedNurse.name}` : 'All nurses'} · last {RANGE_PRESETS.find((p) => p.key === preset)?.label ?? '90 days'}</p>
        </div>
        <div className="toolbar">
          <select
            className="select"
            style={{ width: 'auto', minWidth: 170 }}
            value={nurseId}
            onChange={(e) => update({ nurse: e.target.value })}
            aria-label="Filter by nurse"
          >
            <option value="">All nurses</option>
            {nurseList.data?.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Date range">
            {RANGE_PRESETS.map((p) => (
              <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => update({ range: p.key === '90' ? '' : p.key })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {firstError && <ErrorBox error={firstError} onRetry={() => { overview.reload(); trend.reload(); nurses.reload(); followUps.reload(); }} />}

      <div className="stack">
        {overview.data ? <KpiTiles data={overview.data} /> : <Loading height={130} />}

        {trend.data ? <TrendCharts data={trend.data} title={selectedNurse?.name ?? 'All nurses'} /> : <Loading height={290} />}

        {nurses.data ? (
          <NurseTable nurses={nurses.data} selectedId={nurseId} onSelect={(id) => { update({ nurse: id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        ) : (
          <Loading height={400} />
        )}

        <div className="grid wide-left">
          {followUps.data ? <FollowUpList items={visibleFollowUps} onChange={refreshAfterResolve} /> : <Loading height={300} />}
          <div className="stack" style={{ alignContent: 'start' }}>
            {overview.data && <CategoryBars categories={overview.data.current.categories} />}
            {overview.data && (
              <section className="card">
                <div className="card-head"><h2>Comment sentiment</h2><span className="subtle">automatic tagging</span></div>
                <div className="card-pad" style={{ display: 'grid', gap: 8, paddingTop: 10 }}>
                  {[
                    ['positive', 'Positive', 'chip-good'],
                    ['neutral', 'Neutral', ''],
                    ['negative', 'Negative', 'chip-critical'],
                  ].map(([k, label, cls]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className={`chip ${cls}`}>{label}</span>
                      <span className="tabular cell-strong">{overview.data.sentiment[k]}</span>
                    </div>
                  ))}
                  <div className="subtle" style={{ marginTop: 4 }}>
                    {overview.data.flaggedComments} comment{overview.data.flaggedComments === 1 ? '' : 's'} had abusive words hidden.
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
