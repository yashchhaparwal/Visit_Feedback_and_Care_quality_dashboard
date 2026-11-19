import { CATEGORIES, fmt, formatDate, npsGroup } from '../lib/format.js';
import { EyeOffIcon } from './icons.jsx';

const SENTIMENT = {
  positive: { cls: 'chip-good', label: 'Positive' },
  neutral: { cls: '', label: 'Neutral' },
  negative: { cls: 'chip-critical', label: 'Negative' },
};

export function SentimentChip({ value }) {
  if (!value) return null;
  const s = SENTIMENT[value];
  return <span className={`chip ${s.cls}`} title="Comment sentiment (automatic)">{s.label}</span>;
}

export function NpsChip({ score }) {
  const g = npsGroup(score);
  const cls = g === 'promoter' ? 'chip-good' : g === 'detractor' ? 'chip-critical' : '';
  return <span className={`chip ${cls}`} title="Likely to recommend, 0-10">Recommend {score}/10</span>;
}

export function RatingPills({ ratings }) {
  return (
    <div className="ratings">
      {CATEGORIES.map((c) => (
        <span key={c.key} className={`rating-pill ${ratings[c.key] <= 2 ? 'low' : ''}`}>
          {c.label} {ratings[c.key]}★
        </span>
      ))}
    </div>
  );
}

/** One feedback response as a card row. `actions` renders below (e.g. resolve controls). */
export default function FeedbackItem({ item, actions, showFollowUp = true }) {
  return (
    <article className="item">
      <div className="item-head">
        <div>
          <strong>{item.nurse.name}</strong>
          <span className="muted"> · {item.family.contactName} for {item.family.patientName}</span>
        </div>
        <span className={`tabular ${item.overall < 3 ? 'score-low' : 'cell-strong'}`} title="Average of the four ratings">
          {fmt(item.overall, 1)} / 5
        </span>
      </div>
      <div className="item-meta">
        Visit {formatDate(item.visitDate)} · {item.service} · answered {formatDate(item.submittedAt)}
      </div>
      <RatingPills ratings={item.ratings} />
      <div className="ratings">
        <NpsChip score={item.recommendScore} />
        <SentimentChip value={item.sentiment} />
        {showFollowUp && item.followUp.status === 'open' && <span className="chip chip-critical">● Follow-up open</span>}
        {showFollowUp && item.followUp.status === 'resolved' && <span className="chip chip-good">✓ Followed up</span>}
      </div>
      {item.comment && (
        <div>
          <p className="comment">“{item.comment}”</p>
          {item.commentHidden && (
            <div className="comment-hidden">
              <EyeOffIcon size={14} /> Abusive language hidden
            </div>
          )}
        </div>
      )}
      {item.followUp.status === 'resolved' && item.followUp.note && (
        <div className="subtle">Follow-up note: {item.followUp.note}</div>
      )}
      {actions}
    </article>
  );
}
