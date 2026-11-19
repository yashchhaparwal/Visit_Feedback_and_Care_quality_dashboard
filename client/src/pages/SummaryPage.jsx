import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ErrorBox, Loading } from '../components/States.jsx';
import { MailIcon } from '../components/icons.jsx';

const describeCron = (expr) => (expr === '0 9 * * 1' ? 'every Monday at 9:00 AM IST' : `on schedule "${expr}" (IST)`);

export default function SummaryPage() {
  const preview = useApi('/api/admin/summary/preview');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function sendNow() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api('/api/admin/summary/send', { method: 'POST' }));
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  const p = preview.data;
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Weekly summary email</h1>
          <p className="muted">
            {p ? <>Sent automatically {describeCron(p.schedule)} to {p.to.join(', ')}.</> : 'Loading…'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={sendNow} disabled={sending || !p}>
          <MailIcon size={16} /> {sending ? 'Sending…' : 'Send now'}
        </button>
      </header>

      {p && !p.smtpConfigured && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          SMTP is not configured, so “Send now” saves the email as an HTML file in <code>server/outbox/</code> instead of sending it.
          Add SMTP settings to <code>.env</code> to deliver real email.
        </div>
      )}
      {result && (
        <div className="alert alert-ok" style={{ marginBottom: 16 }} role="status">
          {result.delivered ? `Sent to ${result.to.join(', ')}.` : `Saved to ${result.savedTo}.`}
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {preview.error && <ErrorBox error={preview.error} onRetry={preview.reload} />}

      {p ? (
        <section className="card">
          <div className="card-head" style={{ paddingBottom: 12 }}>
            <h2 style={{ overflowWrap: 'anywhere' }}>Subject: {p.subject}</h2>
          </div>
          <iframe className="iframe-preview" title="Email preview" sandbox="" srcDoc={p.html} />
        </section>
      ) : (
        !preview.error && <Loading height={600} />
      )}
    </>
  );
}
