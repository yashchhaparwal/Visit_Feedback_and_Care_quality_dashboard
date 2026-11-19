# Visit Feedback & Care Quality Dashboard (FS-08)

A feedback loop for home care visits:

- **Families** get a private link after a visit, rate the nurse on punctuality, quality of care, hygiene and behaviour, say how likely they are to recommend us (0–10), and leave a comment. No login is needed. Each link works once and expires after a set number of days.
- **The operations team** gets a dashboard with each nurse's average rating, the trend over time, Net Promoter Score, and a list of low scores to follow up. Abusive language is hidden, all feedback can be exported as CSV, and a summary email goes out every week.

Built with **React (Vite)**, **Node.js / Express** and **SQLite**, using Node's built-in `node:sqlite`, so there is nothing native to compile and no database server to install.

---

## Quick start

Requirements: **Node.js 22.13+** (tested on Node 24).

```bash
git clone <this repo>
cd <repo>
npm install
cp .env.example .env          # defaults work as-is
npm run dev                   # API on :4000, web app on :5173
```

- Dashboard: <http://localhost:5173/admin>. It opens directly; the brief does not ask for a login.
- On first start, the server seeds the database with about 4 months of realistic, made-up data: 12 nurses, 42 families, about 1,700 visits and about 500 responses.
- To try the family form, open **Visits & links**, copy any *Waiting* link, and open it (on your phone too: Vite listens on your LAN IP).

Other commands:

| Command | What it does |
|---|---|
| `npm run seed` | Reset the database to fresh demo data and print three unused feedback links |
| `npm test` | Run the server test suite (Node's built-in test runner) |
| `npm run build && npm start` | Production mode: Express serves the built React app and the API on one port |

### Deploying (Render, free)

The repo includes a [render.yaml](render.yaml) Blueprint. In Render choose **New → Blueprint**, pick this repo, and set `PUBLIC_BASE_URL` to the service URL (e.g. `https://carepal-feedback.onrender.com`). It builds with `npm install --include=dev && npm run build` and starts with `npm start`; one service serves both the API and the React app.

On the free plan the disk is temporary: when the service restarts or sleeps, the SQLite file is lost and the server re-seeds fresh demo data on boot. That's fine for a demo. For real data, attach a persistent disk (paid) and point `DB_PATH` at it, or move to a hosted database.

### Environment variables

See [.env.example](.env.example). The ones that matter:

| Variable | Purpose |
|---|---|
| `PUBLIC_BASE_URL` | Base of the links sent to families |
| `LINK_EXPIRY_DAYS` | Default link lifetime (staff can pick 3, 7 or 14 days per link) |
| `OPS_EMAILS`, `SUMMARY_CRON` | Weekly email recipients and schedule (default: Monday 9:00 IST) |
| `SMTP_*` | Mail server. **If `SMTP_HOST` is empty, the email is written to `server/outbox/` instead**, so the demo works without credentials |

No secrets are committed: `.env` is gitignored.

---

## How it works

```
Family's phone                    Operations team
 /f/:token  (no login)             /admin  (no login)
      │                                  │
      ▼                                  ▼
 /api/public/feedback/:token      /api/admin/*  (stats, feedback, CSV, visits, links, summary)
      │                                  │
      └──────────► Express services ◄────┘
                       │
                    SQLite (node:sqlite)
```

### Data model

`nurses` → `visits` ← `families`. Each visit can have **one** `feedback_links` row (token, `expires_at`, `used_at`) and **one** `feedback` row.

### One-time, expiring links

- The token is 24 random bytes (base64url). It can't be guessed, so the link itself is the credential, and the public routes are rate-limited.
- Submitting runs in a transaction that starts with
  `UPDATE feedback_links SET used_at = now WHERE id = ? AND used_at IS NULL AND expires_at > now`.
  Only one request can change that row, so two taps or two devices can't submit twice. A test fires 5 submissions at the same moment and checks that exactly one is stored.
- An invalid submission (for example, a rating of 9) is rejected *before* the link is used, so the family can fix it and resend.
- Used, expired and unknown links each show a friendly page explaining what happened.
- If a link expires unused, staff can issue a new one for the same visit. A visit that already has feedback can't get another link.

### Dashboard metrics ([server/src/lib/quality.js](server/src/lib/quality.js))

- **Overall rating** = mean of the 4 categories.
- **NPS** = % promoters (9–10) − % detractors (0–6), from the "would you recommend" question.
- **Needs follow-up** if *any* category is ≤ 2, **or** the overall is below 3, **or** the recommend score is ≤ 4. One serious problem (such as hygiene) is enough, even when the average looks fine. These responses appear in *Low scores needing follow-up*, where staff can call the family (tap-to-call) and mark the item resolved with a note.
- **Per-nurse table**: averages per category, NPS, a weekly sparkline, and the change over the last 4 weeks compared with the 4 weeks before. That change catches a slide (like Rakesh's punctuality in the demo data) before it becomes a complaint.
- Every KPI tile is compared with the previous period of the same length. Filters (date range, nurse) live in the URL, so a view can be shared.

### Abusive language filter ([server/src/lib/profanity.js](server/src/lib/profanity.js))

- Comments are **stored exactly as written**. Masking happens when comments are read, in the single function that turns feedback into API output, so no dashboard, export or email path can skip it. Improving the word list later also fixes old comments.
- The filter matches whole words after normalising common tricks: leetspeak (`sh1t`), stretched letters (`fuuuck`), starred letters (`f**k`) and stems (`fucking`). It includes common romanised Hindi abuse, because families write in Hinglish.
- Whole-word matching avoids false positives like *assist*, *class* or *Scunthorpe*, and numbers are never matched. Tests cover both directions.
- Hidden words show as `•••••` with an "Abusive language hidden" label. The CSV export is masked too.

### Sentiment tags (bonus)

Each comment is tagged positive, neutral or negative using the AFINN-165 word list (the `sentiment` package, which handles "not good"), extended with care-specific words (*late*, *rude*, *unhygienic*, *punctual*) and Hinglish (*accha*, *bekar*, *gussa*). Feedback can be filtered by sentiment.

### Weekly summary email (bonus)

`node-cron` sends the summary every Monday at 9:00 IST. It includes the headline numbers compared with the previous week, category averages, nurses needing attention (average below 3.8 or a sharp drop over 8 weeks), top-rated nurses, and open follow-ups. The **Weekly email** page previews it and has a *Send now* button.

### CSV export

Exports every response, or only those matching the current filters, with one column per rating, the NPS group, sentiment, the masked comment and the follow-up status. It's UTF-8 with a BOM, so Excel shows names correctly. Cells starting with `=`, `+`, `-` or `@` are escaped to prevent spreadsheet formula injection.

---

## Design decisions

- **SQLite via `node:sqlite`**: zero setup for reviewers, real SQL for aggregates, and transactions for the one-time link guarantee. The SQL is portable to Postgres; swapping in Firestore would mean replacing the services layer only.
- **Services hold the logic, routes stay thin**: routes validate input with `zod` and call services. `createApp({ db, config })` builds the app on any database, so tests run against an in-memory SQLite with the same seed data.
- **Mobile first for families**: 48 px star targets, a 0–10 scale that wraps to two rows on phones, short Hindi labels under each question, and visible progress hints. The form only loads about 60 KB gzipped, because the dashboard (and its chart library) is code-split away from it.
- **Accessible inputs**: stars and the NPS scale are ARIA radio groups (arrow keys work), and colours are never the only signal (icons and labels accompany status colours). Dark mode follows the OS.
- **Charts**: average rating and NPS are separate charts rather than one chart with two y-axes, because they use different scales.
- **Security basics**: helmet headers, a JSON body size limit, a rate limit on the public feedback routes, and parameterised SQL everywhere.

### Assumptions

- One feedback request per visit. In the demo, operations asks each family about once a week, not after every shift.
- The dashboard has no login, because the brief does not ask for one and this is a demo running on synthetic data. Before real use it must sit behind staff sign-in (see *What's next*), because it shows family names, phone numbers and complaints.
- Visits normally come from the nurse app; the **Log a visit** form exists so a link can be created end to end in the demo.
- Week buckets and date ranges use UTC dates on the server (at most 5.5 hours off IST at the boundary).

---

## What I would build next

1. **Automatic sending**: create and send the link by WhatsApp or SMS when the nurse checks out in the nurse app, with one reminder before it expires. Today staff copy the link or use the WhatsApp share button.
2. **Staff sign-in and roles** (Firebase Auth): protect the dashboard, let a city manager see only their nurses, and record who resolved each follow-up.
3. **Alerts on the day, not the week**: notify the care manager immediately when a response has a hygiene or behaviour score of 1, or when a nurse's 4-week average drops by more than 0.5.
4. **Nurse profile page**: full history, comments over time, and the training actions taken, so coaching conversations have evidence.
5. **Multilingual form** (Hindi, Tamil, Marathi and others) and voice notes for families who prefer not to type.
6. **Better sentiment**: a small multilingual model or an LLM call for Hinglish and code-mixed comments, keeping the word list as an offline fallback.
7. Move to Postgres or Firestore, add audit logs, and run tests and a Lighthouse check in CI.

---

## AI tools used

- **Claude Code (Anthropic)**: I used it as a pair programmer to scaffold the project structure, write first drafts of the services, React components and tests, generate the synthetic seed data, and draft this README. I reviewed and adjusted the code, ran the tests, and checked every screen in a browser at phone and desktop sizes. Bugs caught that way include a profanity false positive ("45" read as "as" in leetspeak) and an SQL parameter error on the visits list; both now have regression tests.

All data in this repository is synthetic. Names, phone numbers and comments are invented.

---

## Project structure

```
server/
  src/
    index.js            boot: DB, first-run seed, weekly cron, listen
    app.js              express app (used by tests too)
    config.js           env vars + defaults
    db/database.js      schema, transactions
    db/seed.js          deterministic synthetic demo data
    lib/                profanity, sentiment, quality rules, csv, dates
    services/           links, stats, feedback, visits, weekly summary
    routes/             public (family) + admin routes, zod schemas
    middleware/         auth, validation, error handling
  test/                 node:test unit + API tests
client/
  src/
    pages/              FeedbackForm, Dashboard, FeedbackList, Links, Summary
    components/         KPI tiles, charts, nurse table, follow-ups, star rating…
    lib/                api client, auth context, formatting
```
