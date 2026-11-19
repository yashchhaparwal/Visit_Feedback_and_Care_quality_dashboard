/**
 * Abusive-language filter for the dashboard view.
 *
 * Comments are stored exactly as the family wrote them, so nothing is lost if
 * the word list changes. Every API response that shows a comment to staff runs
 * it through maskAbusive() first.
 *
 * Matching works on whole words after normalising common tricks:
 *   - case and leetspeak:   "Sh1t", "$hit"   -> "shit"
 *   - stretched letters:    "fuuuuck"        -> "fuck"
 *   - starred-out letters:  "f**k", "b*tch"  -> wildcard match
 * Whole-word matching avoids false positives such as "assist", "class" or "Scunthorpe".
 */

// Exact words (after normalisation). Includes common romanised Hindi abuse,
// since many families write in Hinglish.
const EXACT_WORDS = [
  'ass', 'arse', 'asshole', 'bastard', 'bitch', 'bloody', 'bollocks', 'bullshit',
  'crap', 'damn', 'dick', 'dumbass', 'idiot', 'moron', 'piss', 'prick', 'slut',
  'stupid', 'twat', 'wanker', 'whore', 'jackass', 'scumbag',
  // Hinglish
  'bc', 'mc', 'bsdk', 'chutiya', 'chutia', 'chootiya', 'gandu', 'harami', 'haramkhor',
  'kamina', 'kamine', 'kameena', 'kutta', 'kutti', 'kutiya', 'saala', 'sala', 'saali',
  'bhenchod', 'behenchod', 'madarchod', 'bhosdike', 'bhosdi', 'randi', 'chodu', 'ullu',
];

// Stems: any word starting with these is abusive ("fucking", "shitty", "bitches").
// Only stems that never begin an innocent English word are listed.
const STEMS = ['fuck', 'shit', 'bitch', 'cunt', 'motherf', 'bastard', 'chutiy', 'bhosd', 'madarch', 'bhench', 'behench'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

const collapse = (w) => w.replace(/(.)\1+/g, '$1');

const exactSet = new Set(EXACT_WORDS);
// collapsed form -> shortest original length, so "asss" matches "ass" but "as" does not.
const collapsedExact = new Map();
for (const w of EXACT_WORDS) {
  const c = collapse(w);
  collapsedExact.set(c, Math.min(collapsedExact.get(c) ?? Infinity, w.length));
}
const collapsedStems = STEMS.map(collapse);
const allWords = [...new Set([...EXACT_WORDS, ...STEMS])];

function normalise(token) {
  return token
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('');
}

function isAbusiveToken(token) {
  // Numbers like "45" or "100" are never abusive, even though leetspeak would read "45" as "as".
  if (!/\p{L}/u.test(token)) return false;
  const norm = normalise(token);

  // "f**k" style: letters with stars in between. Treat * as one unknown letter.
  if (norm.includes('*')) {
    const letters = norm.replace(/[^a-z*]/g, '');
    if (letters.replace(/\*/g, '').length < 1) return false;
    const pattern = new RegExp(`^${letters.replace(/\*/g, '[a-z]')}`);
    return allWords.some((w) => w.length >= 3 && pattern.test(w) && Math.abs(w.length - letters.length) <= 3);
  }

  const word = norm.replace(/[^a-z]/g, '');
  if (!word) return false;
  if (exactSet.has(word)) return true;
  const c = collapse(word);
  if (collapsedExact.has(c) && word.length >= collapsedExact.get(c)) return true;
  return collapsedStems.some((stem) => c.startsWith(stem));
}

// A token is a run of letters, digits or the leet/star characters we normalise.
const TOKEN_RE = /[\p{L}\p{N}@$*!]+/gu;

/**
 * Returns the comment with abusive words replaced by bullets, plus whether anything was hidden.
 * @param {string | null | undefined} text
 * @returns {{ text: string | null, flagged: boolean }}
 */
export function maskAbusive(text) {
  if (!text) return { text: text ?? null, flagged: false };
  let flagged = false;
  const masked = text.replace(TOKEN_RE, (token) => {
    // Keep trailing "!" ("great!") out of the match decision unless it is part of a word.
    const core = token.replace(/!+$/, '');
    const tail = token.slice(core.length);
    if (core && isAbusiveToken(core)) {
      flagged = true;
      return '•'.repeat(Math.max(3, core.length)) + tail;
    }
    return token;
  });
  return { text: masked, flagged };
}

export function containsAbusive(text) {
  return maskAbusive(text).flagged;
}
