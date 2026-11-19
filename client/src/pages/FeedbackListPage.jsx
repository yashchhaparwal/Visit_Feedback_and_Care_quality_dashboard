import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import FeedbackItem from '../components/FeedbackItem.jsx';
import { DownloadIcon } from '../components/icons.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';

const EMPTY_FILTERS = { search: '', nurseId: '', sentiment: '', followUp: '', flagged: false, sort: 'newest' };

/** Debounce a value so typing in the search box doesn't fire a request per keystroke. */
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function FeedbackListPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const search = useDebounced(filters.search);

  const query = { ...filters, search };
  const list = useApi(`/api/admin/feedback${qs({ ...query, page, pageSize: 15 })}`);
  const nurses = useApi('/api/admin/nurses');

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await api(`/api/admin/feedback/export.csv${qs(query)}`, { raw: true });
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'feedback.csv';
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  }

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 15));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>All feedback</h1>
          <p className="muted">Every response from families. Abusive words are hidden automatically.</p>
        </div>
        <button className="btn btn-primary" onClick={exportCsv} disabled={exporting || total === 0}>
          <DownloadIcon size={16} />
          {exporting ? 'Preparing…' : isFiltered ? `Export ${total} as CSV` : 'Export all as CSV'}
        </button>
      </header>

      {exportError && <ErrorBox error={exportError} />}

      <section className="card">
        <div className="filters">
          <input className="input" type="search" placeholder="Search comments, nurse or family…" value={filters.search} onChange={set('search')} aria-label="Search" />
          <select className="select" value={filters.nurseId} onChange={set('nurseId')} aria-label="Nurse">
            <option value="">All nurses</option>
            {nurses.data?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <select className="select" value={filters.sentiment} onChange={set('sentiment')} aria-label="Sentiment">
            <option value="">Any sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="none">No comment</option>
          </select>
          <select className="select" value={filters.followUp} onChange={set('followUp')} aria-label="Follow-up">
            <option value="">Any follow-up</option>
            <option value="open">Follow-up open</option>
            <option value="resolved">Followed up</option>
            <option value="none">Not needed</option>
          </select>
          <select className="select" value={filters.sort} onChange={set('sort')} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="lowest">Lowest rated</option>
            <option value="highest">Highest rated</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '0 16px 12px', flexWrap: 'wrap' }}>
          <label className="check">
            <input type="checkbox" checked={filters.flagged} onChange={set('flagged')} /> Only comments with hidden language
          </label>
          <span className="subtle" aria-live="polite">{list.loading ? 'Loading…' : `${total} response${total === 1 ? '' : 's'}`}</span>
          {isFiltered && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>Clear filters</button>
          )}
        </div>

        {list.error && <div style={{ padding: '0 16px' }}><ErrorBox error={list.error} onRetry={list.reload} /></div>}
        {!list.data && !list.error && <div style={{ padding: 16 }}><Loading height={300} /></div>}
        {list.data && list.data.items.length === 0 && <div className="empty">No feedback matches these filters.</div>}
        {list.data && list.data.items.length > 0 && (
          <div className="list" style={{ borderTop: '1px solid var(--border)', opacity: list.loading ? 0.6 : 1 }}>
            {list.data.items.map((item) => <FeedbackItem key={item.id} item={item} />)}
          </div>
        )}

        {total > 0 && (
          <nav className="pager" aria-label="Pages">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="muted tabular">Page {page} of {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </nav>
        )}
      </section>
    </>
  );
}
