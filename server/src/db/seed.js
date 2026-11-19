/**
 * Seeds the database with synthetic (made-up) data for the demo.
 * No real people, patients or medical records are used.
 *
 * The data is shaped so the dashboard tells a story:
 *  - most nurses are consistently good
 *  - Rakesh's punctuality slides over the last two months (a problem to catch early)
 *  - Kavita improves steadily after joining
 *  - Sanjay has a behaviour issue that shows up in low scores and comments
 *  - a handful of comments contain abusive language (to show the filter)
 *
 * Run directly to reset the DB:  npm run seed
 */
import { fileURLToPath } from 'node:url';
import { transaction } from './database.js';
import { classifySentiment } from '../lib/sentiment.js';
import { containsAbusive } from '../lib/profanity.js';
import { needsFollowUp, overallRating } from '../lib/quality.js';
import { generateToken } from '../services/linkService.js';
import { addDays, toDateOnly } from '../lib/dates.js';

const DAYS_OF_HISTORY = 120;

// Deterministic PRNG so every seed produces the same demo.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Each nurse has a quality profile: mean rating per category as a function of t (0 = 120 days ago, 1 = today).
const flat = (p, q, h, b) => () => ({ punctuality: p, quality_of_care: q, hygiene: h, behaviour: b });
const NURSES = [
  { name: 'Priya Nair', specialization: 'Elderly care', city: 'Bengaluru', profile: flat(4.6, 4.7, 4.6, 4.8) },
  { name: 'Sunita Yadav', specialization: 'Dementia care', city: 'Delhi NCR', profile: flat(4.4, 4.6, 4.5, 4.6) },
  {
    name: 'Rakesh Kumar', specialization: 'Post-hospital recovery', city: 'Mumbai',
    profile: (t) => {
      const slide = Math.max(0, (t - 0.45) / 0.55); // starts slipping ~2 months ago
      return { punctuality: 4.4 - 2.1 * slide, quality_of_care: 4.3 - 0.9 * slide, hygiene: 4.3 - 0.4 * slide, behaviour: 4.4 - 0.8 * slide };
    },
  },
  { name: 'Anjali Menon', specialization: 'Baby care', city: 'Bengaluru', profile: flat(4.7, 4.8, 4.8, 4.7) },
  { name: 'Mohammed Irfan', specialization: 'Elderly care', city: 'Hyderabad', profile: flat(4.3, 4.2, 3.6, 4.4) },
  {
    name: 'Kavita Sharma', specialization: 'Dementia care', city: 'Pune',
    profile: (t) => ({ punctuality: 3.5 + 1.1 * t, quality_of_care: 3.3 + 1.3 * t, hygiene: 3.8 + 0.8 * t, behaviour: 3.7 + 1.0 * t }),
  },
  { name: 'Deepa Thomas', specialization: 'Post-hospital recovery', city: 'Chennai', profile: flat(4.5, 4.5, 4.6, 4.4) },
  { name: 'Sanjay Patil', specialization: 'Elderly care', city: 'Pune', profile: flat(3.9, 3.8, 4.0, 2.8) },
  { name: 'Lakshmi Iyer', specialization: 'Baby care', city: 'Chennai', profile: flat(4.6, 4.7, 4.7, 4.8) },
  { name: 'Neha Gupta', specialization: 'Elderly care', city: 'Delhi NCR', profile: flat(4.1, 4.2, 4.3, 4.3) },
  { name: 'Arjun Reddy', specialization: 'Post-hospital recovery', city: 'Hyderabad', profile: flat(3.9, 4.1, 4.0, 4.2) },
  { name: 'Fatima Shaikh', specialization: 'Dementia care', city: 'Mumbai', profile: flat(4.5, 4.6, 4.4, 4.7) },
];

const CONTACT_FIRST = ['Rohit', 'Sneha', 'Amit', 'Pooja', 'Vikram', 'Meera', 'Karan', 'Ritu', 'Arvind', 'Nisha', 'Suresh', 'Divya', 'Manoj', 'Shreya', 'Rahul', 'Anita', 'Gaurav', 'Swati', 'Nikhil', 'Bhavna'];
const SURNAMES = ['Verma', 'Iyer', 'Kulkarni', 'Banerjee', 'Desai', 'Rao', 'Malhotra', 'Pillai', 'Joshi', 'Chatterjee', 'Agarwal', 'Naidu', 'Kapoor', 'Mehta', 'Krishnan', 'Saxena', 'Bhat', 'Sinha', 'Ghosh', 'Hegde'];
const ELDER_FIRST = ['Kamala', 'Ramesh', 'Shanti', 'Gopal', 'Saroj', 'Vijay', 'Lalita', 'Prakash', 'Usha', 'Mohan', 'Indira', 'Hari'];
const BABY_FIRST = ['Aarav', 'Diya', 'Vihaan', 'Anaya', 'Ishaan', 'Myra'];

const SERVICE_BY_CARE = {
  'Elderly care': ['Elderly care - day shift', 'Elderly care - 12h', 'Medication & vitals check'],
  'Dementia care': ['Dementia care - day shift', 'Dementia care - night shift'],
  'Baby care': ['Newborn care', 'Baby care - day shift'],
  'Post-hospital recovery': ['Post-surgery wound care', 'Recovery care - 12h', 'Physio assistance'],
};

const COMMENTS = {
  positive: [
    '{n} is very caring and patient with my mother. We are very happy.',
    'Always on time and very professional. Thank you {n}!',
    '{n} didi bahut acchi hai, mummy ko time pe dawai deti hai.',
    'Excellent care. Papa looks forward to her visits.',
    'Very clean and hygienic, follows every instruction from the doctor.',
    'Gentle with the baby and gave us great tips on feeding. Highly recommend.',
    '{n} handled the wound dressing perfectly. Recovery is going well.',
    'Punctual, polite and skilled. Exactly what we needed.',
    'Bahut badiya service. Very satisfied.',
    'My father is much happier since {n} started. Wonderful nurse.',
    'Kept detailed notes of BP and sugar every day, very helpful for the doctor.',
    'Friendly and respectful, explains everything clearly.',
    'Great job with the physio exercises, he is walking better now.',
    'Thank you for the amazing care during a difficult time.',
  ],
  neutral: [
    'Care was okay. Came 15 minutes late once.',
    'Good overall but needs to update the care log more regularly.',
    'Theek hai. Some days better than others.',
    'Fine. Would like the same nurse every day instead of substitutes.',
    'Decent care, but communication with the family could be better.',
    'Visit was fine.',
    'Ok service, nothing special.',
    'She is caring but sometimes on the phone during the shift.',
  ],
  punctuality: [
    'Came late again, almost an hour. We had to wait to leave for work.',
    '{n} has been late three times this week. Please fix this.',
    'Not punctual at all. Shift started 45 minutes late.',
    'Roz der se aate hain. Very disappointing.',
  ],
  quality_of_care: [
    'Forgot to give the afternoon medicine. This is serious.',
    'Did not follow the diet chart the doctor gave us.',
    'Careless with the dressing, the wound got infected.',
    'Did not help with exercises at all, just sat and watched TV.',
  ],
  hygiene: [
    'Did not wash hands before handling the catheter. Unhygienic.',
    'Left the room dirty and used linen on the floor.',
    'Hygiene needs a lot of improvement.',
  ],
  behaviour: [
    'Rude to my father and shouted at him when he was slow.',
    'Very impatient with mummy. She was upset after the shift.',
    'Argued with us when we asked for help. Unprofessional.',
    'Gussa bahut karte hain, papa dar jaate hain.',
  ],
  abusive: [
    'Bloody useless nurse, slept through the whole night shift.',
    'This is bullshit, she came 2 hours late AGAIN.',
    'Worst service. The nurse is an idiot who forgot the insulin.',
    'Total bakwas, kamina type behaviour with my father.',
    'What the f**k is this service, nobody turned up on time.',
  ],
};

const RESOLUTION_NOTES = [
  'Called the family, apologised. Nurse counselled on punctuality.',
  'Spoke to family. Arranged a replacement nurse from next week.',
  'Family satisfied after a call with the care manager.',
  'Refresher training on hygiene protocol scheduled for the nurse.',
  'Discussed with nurse and family; shift timing adjusted.',
];

export function seedDatabase(db, config, { now = new Date(), seed = 8 } = {}) {
  const rand = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const normal = (mean, sd) => {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const iso = (d) => new Date(d).toISOString();

  return transaction(db, () => {
    for (const table of ['feedback', 'feedback_links', 'visits', 'families', 'nurses']) {
      db.exec(`DELETE FROM ${table}`);
    }

    const start = addDays(toDateOnly(now), -DAYS_OF_HISTORY);

    // --- Nurses
    const insertNurse = db.prepare('INSERT INTO nurses (name, phone, specialization, city, joined_on) VALUES (?, ?, ?, ?, ?)');
    const nurses = NURSES.map((n, i) => {
      const joined = n.name === 'Kavita Sharma' ? toDateOnly(addDays(start, -10)) : toDateOnly(addDays(start, -200 - i * 40));
      const id = Number(insertNurse.run(n.name, `+91 98${String(450000 + i * 7919).padStart(8, '0')}`, n.specialization, n.city, joined).lastInsertRowid);
      return { ...n, id };
    });

    // --- Families: ~3-4 per nurse, matched on city and type of care
    const insertFamily = db.prepare('INSERT INTO families (contact_name, patient_name, phone, email, city, care_type) VALUES (?, ?, ?, ?, ?, ?)');
    const families = [];
    nurses.forEach((nurse, ni) => {
      const count = 3 + (ni % 2);
      for (let k = 0; k < count; k++) {
        const surname = SURNAMES[(ni * 4 + k) % SURNAMES.length];
        const contactFirst = CONTACT_FIRST[(ni * 3 + k * 7) % CONTACT_FIRST.length];
        const patientFirst = nurse.specialization === 'Baby care' ? pick(BABY_FIRST) : pick(ELDER_FIRST);
        const contact = `${contactFirst} ${surname}`;
        const id = Number(
          insertFamily.run(
            contact,
            `${patientFirst} ${surname}`,
            `+91 9${String(800000000 + families.length * 104729).slice(0, 9)}`,
            `${contactFirst.toLowerCase()}.${surname.toLowerCase()}@example.com`,
            nurse.city,
            nurse.specialization,
          ).lastInsertRowid,
        );
        families.push({ id, nurse, bias: normal(0, 0.25), name: contact });
      }
    });

    const insertVisit = db.prepare('INSERT INTO visits (nurse_id, family_id, visit_date, shift, service, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insertLink = db.prepare('INSERT INTO feedback_links (token, visit_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)');
    const insertFeedback = db.prepare(
      `INSERT INTO feedback (link_id, visit_id, punctuality, quality_of_care, hygiene, behaviour, overall, recommend_score,
         comment, comment_flagged, sentiment, sentiment_score, needs_follow_up, follow_up_status, follow_up_note,
         follow_up_resolved_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const counts = { visits: 0, links: 0, feedback: 0 };
    const pendingLinks = [];

    for (const fam of families) {
      // Kavita joined at the start of the window; give her families a later start.
      let day = Math.floor(rand() * 3);
      let lastFeedbackWeek = -1;
      while (day <= DAYS_OF_HISTORY) {
        const visitDate = addDays(start, day);
        const t = day / DAYS_OF_HISTORY;
        // 10% of visits are covered by a substitute from the same city.
        const sameCity = nurses.filter((n) => n.city === fam.nurse.city && n.id !== fam.nurse.id);
        const nurse = rand() < 0.1 && sameCity.length ? pick(sameCity) : fam.nurse;
        const service = pick(SERVICE_BY_CARE[fam.nurse.specialization]);
        const shift = service.includes('night') ? 'night' : service.includes('12h') ? '24h' : 'day';
        const visitId = Number(
          insertVisit.run(nurse.id, fam.id, toDateOnly(visitDate), shift, service, iso(addDays(visitDate, -2))).lastInsertRowid,
        );
        counts.visits++;

        // Ops asks for feedback roughly once a week per family.
        const week = Math.floor(day / 7);
        if (week !== lastFeedbackWeek && rand() < 0.85) {
          lastFeedbackWeek = week;
          const createdAt = new Date(visitDate.getTime() + (12.5 + rand() * 3) * 3600e3); // evening IST, same day
          if (createdAt > now) break;
          const expiresAt = addDays(createdAt, config.linkExpiryDays);
          const token = generateToken();
          const responds = rand() < 0.7;
          const usedAt = responds ? new Date(createdAt.getTime() + (0.5 + rand() * 70) * 3600e3) : null;
          const answered = usedAt && usedAt < now && usedAt < expiresAt;
          const linkId = Number(insertLink.run(token, visitId, iso(createdAt), iso(expiresAt), answered ? iso(usedAt) : null).lastInsertRowid);
          counts.links++;
          if (!answered && expiresAt > now) pendingLinks.push(token);

          if (answered) {
            const mean = nurse.profile(t);
            const ratings = {};
            for (const [k, m] of Object.entries(mean)) ratings[k] = Math.round(clamp(normal(m + fam.bias, 0.65), 1, 5));
            const overall = overallRating(ratings);
            ratings.recommend_score = Math.round(clamp(normal(((overall - 1) / 4) * 10 + 0.6, 1.2), 0, 10));

            // Pick a comment that fits the ratings. Unhappy families comment more often.
            const lowest = Object.entries(ratings).filter(([k]) => k !== 'recommend_score').sort((a, b) => a[1] - b[1])[0];
            let comment = null;
            if (lowest[1] <= 2 && rand() < 0.85) {
              comment = rand() < 0.14 ? pick(COMMENTS.abusive) : pick(COMMENTS[lowest[0]]);
            } else if (overall >= 4.25 && rand() < 0.55) {
              comment = pick(COMMENTS.positive);
            } else if (rand() < 0.45) {
              comment = overall >= 3.5 ? pick(COMMENTS.neutral) : pick(COMMENTS[lowest[0]]);
            }
            if (comment) comment = comment.replace('{n}', nurse.name.split(' ')[0]);

            const sentiment = classifySentiment(comment);
            const followUp = needsFollowUp(ratings);
            const ageDays = (now - usedAt) / 86400e3;
            const resolved = followUp && ageDays > 10 && rand() < 0.8;
            insertFeedback.run(
              linkId, visitId, ratings.punctuality, ratings.quality_of_care, ratings.hygiene, ratings.behaviour, overall,
              ratings.recommend_score, comment, containsAbusive(comment) ? 1 : 0, sentiment.label, sentiment.score,
              followUp ? 1 : 0, followUp ? (resolved ? 'resolved' : 'open') : 'none',
              resolved ? pick(RESOLUTION_NOTES) : null,
              resolved ? iso(new Date(usedAt.getTime() + (1 + rand() * 48) * 3600e3)) : null,
              iso(usedAt),
            );
            counts.feedback++;
          }
        }
        day += 2 + Math.floor(rand() * 3); // a visit every 2-4 days
      }
    }

    return { ...counts, nurses: nurses.length, families: families.length, pendingLinks };
  });
}

// Allow `node src/db/seed.js` to reset the database.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { config } = await import('../config.js');
  const { openDatabase } = await import('./database.js');
  const db = openDatabase(config.dbPath);
  const result = seedDatabase(db, config);
  console.log(
    `Seeded ${result.nurses} nurses, ${result.families} families, ${result.visits} visits, ` +
      `${result.links} feedback links, ${result.feedback} responses.`,
  );
  console.log('\nTry these unused feedback links (open on your phone or browser):');
  for (const token of result.pendingLinks.slice(0, 3)) console.log(`  ${config.publicBaseUrl}/f/${token}`);
  db.close();
}
