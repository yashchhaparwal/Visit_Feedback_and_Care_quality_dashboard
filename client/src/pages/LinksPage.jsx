import { useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { formatDate, relativeDays, toIsoDate, whatsappNumber } from '../lib/format.js';
import { CopyIcon, LinkIcon } from '../components/icons.jsx';
import { ErrorBox, Loading } from '../components/States.jsx';

const STATUS = {
  no_link: { label: 'No link yet', cls: '' },
  pending: { label: 'Waiting', cls: 'chip-info' },
  used: { label: 'Answered', cls: 'chip-good' },
  expired: { label: 'Expired', cls: 'chip-warn' },
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'no_link', label: 'No link' },
  { key: 'pending', label: 'Waiting' },
  { key: 'used', label: 'Answered' },
  { key: 'expired', label: 'Expired' },
];

function whatsappHref(visit, url) {
  const msg =
    `Namaste ${visit.family.contactName.split(' ')[0]}, this is TheCarePal. ` +
    `How was ${visit.nurse.name.split(' ')[0]}'s visit on ${formatDate(visit.visitDate)}? ` +
    `Please share quick feedback (under a minute): ${url}`;
  return `https://wa.me/${whatsappNumber(visit.family.phone)}?text=${encodeURIComponent(msg)}`;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt('Copy this link:', text);
        }
      }}
    >
      <CopyIcon size={14} /> {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function LinkActions({ visit, expiryDays, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { link } = visit;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/visits/${visit.id}/link`, { method: 'POST', body: { expiryDays } });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (link.status === 'used') return <span className="subtle">Answered {formatDate(link.usedAt)}</span>;
  return (
    <div className="link-box">
      {link.status === 'pending' && link.url && (
        <>
          <code title={link.url}>{link.url}</code>
          <CopyButton text={link.url} />
          <a className="btn btn-sm" href={whatsappHref(visit, link.url)} target="_blank" rel="noreferrer">WhatsApp</a>
        </>
      )}
      {(link.status === 'no_link' || link.status === 'expired') && (
        <button className="btn btn-sm btn-primary" onClick={create} disabled={busy}>
          <LinkIcon size={14} /> {busy ? 'Creating…' : link.status === 'expired' ? 'New link' : 'Create link'}
        </button>
      )}
      {error && <span className="alert alert-error">{error}</span>}
    </div>
  );
}

function LinkStatus({ link }) {
  const s = STATUS[link.status];
  return (
    <div>
      <span className={`chip ${s.cls}`}>{s.label}</span>
      {link.status === 'pending' && <div className="subtle">expires {relativeDays(link.expiresAt)}</div>}
    </div>
  );
}

function NewVisitForm({ onCreated }) {
  const nurses = useApi('/api/admin/nurses');
  const families = useApi('/api/admin/families');
  const [form, setForm] = useState({ familyId: '', nurseId: '', visitDate: toIsoDate(new Date()), shift: 'day', service: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/visits', { method: 'POST', body: form });
      setForm((f) => ({ ...f, familyId: '', service: '' }));
      onCreated();
    } catch (err) {
      setError(err.fields?.map((f) => `${f.path}: ${f.message}`).join(', ') || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <h2>Log a visit</h2>
      <p className="subtle" style={{ marginTop: -6 }}>Normally visits come from the nurse app; add one here to send a link for it.</p>
      <div className="form-grid">
        <label className="field">
          <span>Family</span>
          <select className="select" required value={form.familyId} onChange={set('familyId')}>
            <option value="">Choose…</option>
            {families.data?.map((f) => <option key={f.id} value={f.id}>{f.contactName} ({f.patientName})</option>)}
          </select>
        </label>
        <label className="field">
          <span>Nurse</span>
          <select className="select" required value={form.nurseId} onChange={set('nurseId')}>
            <option value="">Choose…</option>
            {nurses.data?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" required value={form.visitDate} max={toIsoDate(new Date())} onChange={set('visitDate')} />
        </label>
        <label className="field">
          <span>Shift</span>
          <select className="select" value={form.shift} onChange={set('shift')}>
            <option value="day">Day</option>
            <option value="night">Night</option>
            <option value="24h">12/24 hour</option>
          </select>
        </label>
        <label className="field">
          <span>Service</span>
          <input className="input" required minLength={2} placeholder="e.g. Elderly care - day shift" value={form.service} onChange={set('service')} />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add visit'}</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
    </form>
  );
}

export default function LinksPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expiryDays, setExpiryDays] = useState(7);
  const [showForm, setShowForm] = useState(false);
  const visits = useApi(`/api/admin/visits${qs({ status, search, page, pageSize: 20 })}`);

  const total = visits.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visits & feedback links</h1>
          <p className="muted">Each visit gets one private link. It works once and expires after the days you choose.</p>
        </div>
        <div className="toolbar">
          <label className="field" style={{ gridAutoFlow: 'column', alignItems: 'center' }}>
            <span>Link valid for</span>
            <select className="select" style={{ width: 'auto' }} value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
              {[3, 7, 14].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
          <button className="btn" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : 'Log a visit'}</button>
        </div>
      </header>

      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <NewVisitForm onCreated={() => { setStatus('no_link'); setPage(1); visits.reload(); }} />
        </div>
      )}

      <section className="card">
        <div style={{ display: 'flex', gap: 12, padding: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="segmented" role="group" aria-label="Link status" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {TABS.map((t) => (
              <button key={t.key} type="button" aria-pressed={status === t.key} onClick={() => { setStatus(t.key); setPage(1); }}>{t.label}</button>
            ))}
          </div>
          <input className="input" type="search" style={{ flex: '1 1 200px', width: 'auto' }} placeholder="Search family or nurse…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search visits" />
        </div>

        {visits.error && <div style={{ padding: '0 16px' }}><ErrorBox error={visits.error} onRetry={visits.reload} /></div>}
        {!visits.data && !visits.error && <div style={{ padding: 16 }}><Loading height={300} /></div>}
        {visits.data && visits.data.items.length === 0 && <div className="empty">No visits here.</div>}

        {visits.data && visits.data.items.length > 0 && (
          <>
            <div className="table-wrap visit-table">
              <table className="data">
                <thead>
                  <tr><th>Visit</th><th>Family</th><th>Nurse</th><th>Status</th><th>Link</th></tr>
                </thead>
                <tbody>
                  {visits.data.items.map((v) => (
                    <tr key={v.id}>
                      <td><div className="cell-strong">{formatDate(v.visitDate)}</div><div className="subtle">{v.service}</div></td>
                      <td>{v.family.contactName}<div className="subtle">for {v.family.patientName}</div></td>
                      <td>{v.nurse.name}</td>
                      <td><LinkStatus link={v.link} /></td>
                      <td><LinkActions visit={v} expiryDays={expiryDays} onCreated={visits.reload} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="list visit-cards" style={{ borderTop: '1px solid var(--border)' }}>
              {visits.data.items.map((v) => (
                <article className="item" key={v.id}>
                  <div className="item-head">
                    <strong>{v.family.contactName}</strong>
                    <LinkStatus link={v.link} />
                  </div>
                  <div className="item-meta">{formatDate(v.visitDate)} · {v.nurse.name} · {v.service}</div>
                  <LinkActions visit={v} expiryDays={expiryDays} onCreated={visits.reload} />
                </article>
              ))}
            </div>
          </>
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
