import { useRef } from 'react';
import { StarIcon } from './icons.jsx';

export const STAR_LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

/**
 * 1-5 star input, built as a radio group so it works with keyboard (arrow keys)
 * and screen readers, with 48px tap targets for phones.
 */
export default function StarRating({ name, value, onChange, labelledBy }) {
  const refs = useRef([]);

  const onKeyDown = (e) => {
    const current = value || 0;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, current + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, current - 1);
    if (next) {
      e.preventDefault();
      onChange(next);
      refs.current[next - 1]?.focus();
    }
  };

  return (
    <div className="stars" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => (refs.current[n - 1] = el)}
          type="button"
          role="radio"
          name={name}
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}, ${STAR_LABELS[n - 1]}`}
          tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
          className={`star ${value >= n ? 'on' : ''}`}
          onClick={() => onChange(n)}
        >
          <StarIcon />
        </button>
      ))}
      <span className="star-label" aria-hidden="true">{value ? STAR_LABELS[value - 1] : ''}</span>
    </div>
  );
}
