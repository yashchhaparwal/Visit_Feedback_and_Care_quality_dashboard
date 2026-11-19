import { useState } from 'react';
import { api } from '../lib/api.js';
import FeedbackItem from './FeedbackItem.jsx';
import { PhoneIcon } from './icons.jsx';

function ResolveControls({ item, onResolved }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function resolve(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api(`/api/admin/feedback/${item.id}/follow-up`, { method: 'PATCH', body: { status: 'resolved', note: note.trim() || null } });
      onResolved(updated);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="resolve" onSubmit={resolve}>
      {item.family.phone && (
        <a className="btn btn-sm" href={`tel:${item.family.phone.replace(/\s/g, '')}`}>
          <PhoneIcon size={14} /> Call {item.family.contactName.split(' ')[0]}
        </a>
      )}
      <input
        className="input"
        placeholder="What was done? (e.g. called family, nurse counselled)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        aria-label="Follow-up note"
      />
      <button className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Mark resolved'}</button>
      {error && <div className="alert alert-error" style={{ flexBasis: '100%' }}>{error}</div>}
    </form>
  );
}

/** Low scores that need a call from operations. */
export default function FollowUpList({ items, onChange, initialCount = 5 }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, initialCount);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Low scores needing follow-up</h2>
        <span className="subtle">Any rating ≤ 2, average below 3, or recommend ≤ 4</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">Nothing open. Every low score has been followed up.</div>
      ) : (
        <div className="list" style={{ marginTop: 8 }}>
          {visible.map((item) => (
            <FeedbackItem
              key={item.id}
              item={item}
              showFollowUp={false}
              actions={<ResolveControls item={item} onResolved={() => onChange()} />}
            />
          ))}
          {items.length > initialCount && (
            <div className="item" style={{ justifyItems: 'center' }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer' : `Show all ${items.length}`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
