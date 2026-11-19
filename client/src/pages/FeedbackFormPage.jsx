import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import StarRating from '../components/StarRating.jsx';
import { AlertIcon, CheckIcon, ClockIcon, HeartIcon } from '../components/icons.jsx';

const MAX_COMMENT = 1000;

const questions = (nurse) => [
  { key: 'punctuality', title: 'Punctuality', hint: `Did ${nurse} arrive on time and stay for the full shift?`, hindi: 'समय पर आना और पूरी शिफ्ट रहना' },
  { key: 'qualityOfCare', title: 'Quality of care', hint: 'Medicines, meals, exercises and care plan followed properly?', hindi: 'देखभाल की गुणवत्ता' },
  { key: 'hygiene', title: 'Hygiene', hint: 'Clean hands, gloves, tidy room and equipment?', hindi: 'साफ़-सफ़ाई' },
  { key: 'behaviour', title: 'Behaviour', hint: 'Kind, patient and respectful with your family?', hindi: 'व्यवहार' },
];

function Shell({ children }) {
  return (
    <div className="family">
      <div className="family-wrap">
        <header className="family-top">
          <span className="brand-mark"><HeartIcon size={16} /></span>
          TheCarePal
        </header>
        {children}
      </div>
    </div>
  );
}

function Message({ icon, tone, title, children }) {
  return (
    <Shell>
      <div className="card done" role="status">
        <div className={`done-icon ${tone === 'neutral' ? 'neutral' : ''}`}>{icon}</div>
        <h1>{title}</h1>
        <p className="muted">{children}</p>
      </div>
    </Shell>
  );
}

export default function FeedbackFormPage() {
  const { token } = useParams();
  const [visit, setVisit] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [answers, setAnswers] = useState({ punctuality: 0, qualityOfCare: 0, hygiene: 0, behaviour: 0, recommendScore: null });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    api(`/api/public/feedback/${encodeURIComponent(token)}`)
      .then(setVisit)
      .catch(setLoadError);
  }, [token]);

  if (done) {
    return (
      <Message icon={<CheckIcon size={30} />} title="Thank you!">
        Your feedback has been shared with our care team. It helps us look after your family better.
        {answers.recommendScore !== null && answers.recommendScore <= 6 && ' Someone from our team may call you to make things right.'}
      </Message>
    );
  }

  if (loadError) {
    if (loadError.code === 'link_used') {
      return <Message icon={<CheckIcon size={30} />} title="Already received">We already have your feedback for this visit. Thank you!</Message>;
    }
    if (loadError.code === 'link_expired') {
      return (
        <Message icon={<ClockIcon size={30} />} tone="neutral" title="This link has expired">
          Feedback links stay open for a few days after each visit. You can still reach us any time through the CarePal app or by
          replying to our WhatsApp message.
        </Message>
      );
    }
    if (loadError.code === 'link_not_found') {
      return <Message icon={<AlertIcon size={30} />} tone="neutral" title="Link not recognised">Please check that you opened the full link from our message.</Message>;
    }
    return <Message icon={<AlertIcon size={30} />} tone="neutral" title="Something went wrong">{loadError.message}</Message>;
  }

  if (!visit) {
    return (
      <Shell>
        <div className="card family-hero" aria-busy="true">
          <div className="skeleton" style={{ height: 24, width: '70%' }} />
          <div className="skeleton" style={{ height: 16, width: '50%' }} />
        </div>
        <div className="card skeleton" style={{ height: 420 }} />
      </Shell>
    );
  }

  const nurseFirst = visit.nurseName.split(' ')[0];
  const qs = questions(nurseFirst);
  const missing = [...qs.filter((q) => !answers[q.key]).map((q) => q.title), ...(answers.recommendScore === null ? ['Recommendation'] : [])];
  const set = (key) => (v) => setAnswers((a) => ({ ...a, [key]: v }));

  async function onSubmit(e) {
    e.preventDefault();
    if (missing.length) {
      setShowMissing(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api(`/api/public/feedback/${encodeURIComponent(token)}`, { method: 'POST', body: { ...answers, comment: comment.trim() || null } });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err.code === 'link_used' || err.code === 'link_expired') setLoadError(err);
      else setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <section className="card family-hero">
        <h1>How was {nurseFirst}'s care for {visit.patientName}?</h1>
        <p className="muted">
          {visit.service} · {formatDate(visit.visitDate)}
        </p>
        <p className="subtle">Takes under a minute. Your answers go to our care quality team, not to the nurse directly.</p>
      </section>

      <form className="card" onSubmit={onSubmit} noValidate>
        {qs.map((q) => (
          <div className="question" key={q.key}>
            <fieldset>
              <legend id={`q-${q.key}`}>
                {q.title} <span className="subtle" lang="hi">· {q.hindi}</span>
                <div className="q-hint">{q.hint}</div>
              </legend>
              <StarRating name={q.key} value={answers[q.key]} onChange={set(q.key)} labelledBy={`q-${q.key}`} />
            </fieldset>
          </div>
        ))}

        <div className="question">
          <fieldset>
            <legend id="q-nps">
              How likely are you to recommend TheCarePal to a friend or relative?
              <div className="q-hint">0 = not at all likely, 10 = extremely likely</div>
            </legend>
            <div className="nps" role="radiogroup" aria-labelledby="q-nps">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={answers.recommendScore === n}
                  onClick={() => set('recommendScore')(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="nps-ends" aria-hidden="true">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </fieldset>
        </div>

        <div className="question">
          <label className="field" htmlFor="comment">
            <span style={{ color: 'var(--ink)', fontSize: '1rem', fontWeight: 600 }}>Anything else you'd like to tell us? <span className="subtle">(optional)</span></span>
            <textarea
              id="comment"
              className="textarea"
              maxLength={MAX_COMMENT}
              placeholder={`What did ${nurseFirst} do well? What could be better? You can write in English or Hindi.`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="char-count">{comment.length}/{MAX_COMMENT}</div>
        </div>

        <div className="submit-bar">
          {showMissing && missing.length > 0 && (
            <div className="alert alert-error" role="alert">Please answer: {missing.join(', ')}.</div>
          )}
          {submitError && <div className="alert alert-error" role="alert">{submitError}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
          <p className="subtle" style={{ textAlign: 'center' }}>This link can be used once and expires {formatDate(visit.expiresAt)}.</p>
        </div>
      </form>
    </Shell>
  );
}
