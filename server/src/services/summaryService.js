import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { addDays, toDateOnly } from '../lib/dates.js';
import { RATING_LABELS } from '../lib/quality.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmt = (n, dp = 2) => (n === null || n === undefined ? '-' : Number(n).toFixed(dp));

function delta(current, previous, dp = 2, suffix = '') {
  if (current === null || previous === null || current === undefined || previous === undefined) return '';
  const d = current - previous;
  if (Math.abs(d) < 10 ** -dp) return '<span style="color:#52514e">no change</span>';
  const up = d > 0;
  return `<span style="color:${up ? '#006300' : '#b42318'}">${up ? '▲' : '▼'} ${Math.abs(d).toFixed(dp)}${suffix} vs previous week</span>`;
}

/**
 * Weekly summary for the operations team: headline numbers vs last week,
 * nurses who need attention, and open low-score follow-ups.
 */
export function createSummaryService({ stats, feedback, config, logger = console }) {
  function build(now = new Date()) {
    const end = addDays(toDateOnly(now), 1).toISOString();
    const start = addDays(end, -7).toISOString();
    const overview = stats.overview({ start, end });
    const nurses = stats.nurses({ start: addDays(end, -56).toISOString(), end });
    const weekNurses = stats.nurses({ start, end });
    const openFollowUps = feedback.followUps({ status: 'open', limit: 10 });

    const c = overview.current;
    const p = overview.previous;
    const attention = nurses
      .filter((n) => n.responses >= 3 && (n.overall < 3.8 || (n.change !== null && n.change <= -0.4)))
      .slice(0, 6);
    const stars = [...weekNurses].filter((n) => n.responses >= 2).sort((a, b) => b.overall - a.overall).slice(0, 3);

    const periodLabel = `${toDateOnly(start)} to ${toDateOnly(addDays(end, -1))}`;
    const subject = `Weekly care quality summary: ${c.responses} responses, avg ${fmt(c.overall, 1)}/5, NPS ${c.nps ?? '-'}`;

    const tile = (label, value, sub) => `
      <td style="padding:12px 16px;border:1px solid #e1e0d9;border-radius:8px;background:#fcfcfb;vertical-align:top">
        <div style="font-size:12px;color:#52514e;text-transform:uppercase;letter-spacing:.04em">${label}</div>
        <div style="font-size:26px;font-weight:600;color:#0b0b0b;margin:4px 0">${value}</div>
        <div style="font-size:12px">${sub}</div>
      </td>`;

    const html = `<!doctype html><html><body style="margin:0;background:#f4f3ef;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b">
<div style="max-width:640px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 4px">Weekly care quality summary</h1>
  <p style="margin:0 0 20px;color:#52514e;font-size:14px">${esc(periodLabel)}</p>
  <table role="presentation" cellspacing="8" style="width:100%;border-collapse:separate"><tr>
    ${tile('Responses', c.responses, delta(c.responses, p.responses, 0))}
    ${tile('Avg rating', `${fmt(c.overall, 2)}<span style="font-size:14px;color:#52514e"> / 5</span>`, delta(c.overall, p.overall))}
    ${tile('NPS', c.nps ?? '-', delta(c.nps, p.nps, 0))}
  </tr><tr>
    ${tile('Open follow-ups', overview.openFollowUps, '<span style="color:#52514e">low scores awaiting a call</span>')}
    ${tile('Response rate', overview.responseRate.rate === null ? '-' : `${Math.round(overview.responseRate.rate * 100)}%`, `<span style="color:#52514e">${overview.responseRate.answered} of ${overview.responseRate.sent} links</span>`)}
    ${tile('Hidden comments', overview.flaggedComments, '<span style="color:#52514e">abusive language filtered</span>')}
  </tr></table>

  <h2 style="font-size:16px;margin:24px 0 8px">Category averages this week</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${Object.entries(RATING_LABELS)
      .map(([k, label]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #e1e0d9">${label}</td><td style="padding:6px 0;border-bottom:1px solid #e1e0d9;text-align:right;font-weight:600">${fmt(c.categories[k])}</td></tr>`)
      .join('')}
  </table>

  <h2 style="font-size:16px;margin:24px 0 8px">Nurses needing attention (last 8 weeks)</h2>
  ${attention.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="color:#52514e;text-align:left"><th style="padding:6px 0">Nurse</th><th>Avg</th><th>Change (4 wk)</th><th>Open follow-ups</th></tr>
        ${attention.map((n) => `<tr>
          <td style="padding:6px 0;border-top:1px solid #e1e0d9">${esc(n.name)}</td>
          <td style="border-top:1px solid #e1e0d9">${fmt(n.overall)}</td>
          <td style="border-top:1px solid #e1e0d9;color:${(n.change ?? 0) < 0 ? '#b42318' : '#52514e'}">${n.change === null ? '-' : (n.change > 0 ? '+' : '') + fmt(n.change)}</td>
          <td style="border-top:1px solid #e1e0d9">${n.openFollowUps}</td></tr>`).join('')}
      </table>`
    : '<p style="font-size:14px;color:#52514e">No nurse is below 3.8 or dropping sharply. 🎉</p>'}

  ${stars.length ? `<h2 style="font-size:16px;margin:24px 0 8px">Top rated this week</h2>
  <p style="font-size:14px;margin:0">${stars.map((n) => `${esc(n.name)} (${fmt(n.overall)})`).join(' · ')}</p>` : ''}

  <h2 style="font-size:16px;margin:24px 0 8px">Open low-score follow-ups</h2>
  ${openFollowUps.length
    ? openFollowUps.map((f) => `<div style="padding:10px 12px;margin-bottom:8px;background:#fff;border:1px solid #e1e0d9;border-left:4px solid #d03b3b;border-radius:6px;font-size:14px">
        <strong>${esc(f.family.contactName)}</strong> about <strong>${esc(f.nurse.name)}</strong> · visit ${esc(f.visitDate)} · avg ${fmt(f.overall)} · NPS answer ${f.recommendScore}
        ${f.comment ? `<div style="color:#52514e;margin-top:4px">"${esc(f.comment)}"</div>` : ''}
      </div>`).join('')
    : '<p style="font-size:14px;color:#52514e">Nothing open. Every low score has been followed up.</p>'}

  <p style="margin-top:24px"><a href="${esc(config.publicBaseUrl)}/admin" style="color:#2a78d6">Open the dashboard</a></p>
</div></body></html>`;

    const text = [
      `Weekly care quality summary (${periodLabel})`,
      `Responses: ${c.responses} | Avg rating: ${fmt(c.overall)} / 5 | NPS: ${c.nps ?? '-'}`,
      `Open follow-ups: ${overview.openFollowUps}`,
      `Nurses needing attention: ${attention.map((n) => `${n.name} (${fmt(n.overall)})`).join(', ') || 'none'}`,
      `Dashboard: ${config.publicBaseUrl}/admin`,
    ].join('\n');

    return { subject, html, text };
  }

  /**
   * Sends the summary over SMTP. Without SMTP settings (local dev / demo) it writes
   * the email to server/outbox/ so it can still be opened and checked.
   */
  async function send(now = new Date()) {
    const email = build(now);
    if (!config.smtp.host) {
      fs.mkdirSync(config.outboxDir, { recursive: true });
      const file = path.join(config.outboxDir, `weekly-summary-${toDateOnly(now)}.html`);
      fs.writeFileSync(file, email.html);
      logger.info?.(`[summary] SMTP not configured - wrote ${file}`);
      return { delivered: false, savedTo: path.relative(config.serverRoot, file), to: config.opsEmails, subject: email.subject };
    }
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
    const info = await transport.sendMail({
      from: config.smtp.from,
      to: config.opsEmails.join(', '),
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    logger.info?.(`[summary] sent to ${config.opsEmails.join(', ')} (${info.messageId})`);
    return { delivered: true, messageId: info.messageId, to: config.opsEmails, subject: email.subject };
  }

  return { build, send };
}
