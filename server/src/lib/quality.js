/**
 * Business rules for care quality. Kept in one place so the dashboard,
 * the weekly email and the tests all agree.
 */

export const RATING_FIELDS = ['punctuality', 'quality_of_care', 'hygiene', 'behaviour'];

export const RATING_LABELS = {
  punctuality: 'Punctuality',
  quality_of_care: 'Quality of care',
  hygiene: 'Hygiene',
  behaviour: 'Behaviour',
};

/** Mean of the four category ratings, rounded to 2 decimals. */
export function overallRating(r) {
  const sum = r.punctuality + r.quality_of_care + r.hygiene + r.behaviour;
  return Math.round((sum / 4) * 100) / 100;
}

/**
 * A response needs a follow-up call from operations when any of these is true:
 *  - any single category is rated 2 or below (one serious problem is enough)
 *  - the overall average is below 3
 *  - the family would be unlikely to recommend us (0-4 on the 0-10 scale)
 */
export const FOLLOW_UP_RULES = {
  maxCategoryRating: 2,
  minOverall: 3,
  maxRecommendScore: 4,
};

export function needsFollowUp(r) {
  const lowest = Math.min(r.punctuality, r.quality_of_care, r.hygiene, r.behaviour);
  return (
    lowest <= FOLLOW_UP_RULES.maxCategoryRating ||
    overallRating(r) < FOLLOW_UP_RULES.minOverall ||
    r.recommend_score <= FOLLOW_UP_RULES.maxRecommendScore
  );
}

/**
 * Net Promoter Score: % promoters (9-10) minus % detractors (0-6). Range -100..100.
 * @param {number[]} scores
 */
export function netPromoterScore(scores) {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

/** SQL fragment computing NPS over a recommend_score column. Returns NULL for no rows. */
export const NPS_SQL = `CASE WHEN COUNT(*) = 0 THEN NULL ELSE
  ROUND(100.0 * (SUM(CASE WHEN f.recommend_score >= 9 THEN 1 ELSE 0 END)
               - SUM(CASE WHEN f.recommend_score <= 6 THEN 1 ELSE 0 END)) / COUNT(*)) END`;
