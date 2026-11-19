import Sentiment from 'sentiment';
import { containsAbusive } from './profanity.js';

/**
 * Tags a comment as positive, neutral or negative.
 *
 * Uses the AFINN-165 word list (via the `sentiment` package, which also handles
 * simple negation like "not good"), extended with care-specific words and common
 * Hinglish phrases families actually use.
 */
const analyzer = new Sentiment();

const CARE_LANGUAGE = {
  extras: {
    // care-specific English
    punctual: 2, 'on-time': 2, caring: 3, gentle: 2, patient: 2, attentive: 2,
    professional: 2, polite: 2, clean: 2, hygienic: 2, trained: 1, skilled: 2,
    late: -2, delayed: -2, careless: -3, unhygienic: -3, dirty: -3, unprofessional: -3,
    rude: -3, shouted: -3, shouting: -3, sleeping: -2, slept: -2, phone: -1, absent: -2,
    impatient: -2, rough: -2, smell: -2, smelled: -2, missed: -2, forgot: -2, ignored: -2,
    // Hinglish
    accha: 2, acha: 2, achha: 2, acchi: 2, achhi: 2, badiya: 3, badhiya: 3, shandar: 3,
    mast: 2, khush: 2, dhanyavad: 2, shukriya: 2, theek: 1, thik: 1,
    bekar: -3, bekaar: -3, ganda: -3, gandi: -3, bura: -2, buri: -2, kharab: -3, gussa: -2,
    der: -1, lapravah: -3, laparwah: -3,
  },
};

const POSITIVE_THRESHOLD = 1;
const NEGATIVE_THRESHOLD = -1;

/**
 * @param {string | null | undefined} text
 * @returns {{ label: 'positive' | 'neutral' | 'negative' | null, score: number | null }}
 */
export function classifySentiment(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { label: null, score: null };

  let { score } = analyzer.analyze(trimmed, CARE_LANGUAGE);
  // Abuse in a comment is a strong negative signal even if the word list misses it.
  if (containsAbusive(trimmed)) score = Math.min(score, 0) - 3;

  const label = score >= POSITIVE_THRESHOLD ? 'positive' : score <= NEGATIVE_THRESHOLD ? 'negative' : 'neutral';
  return { label, score };
}
