export const CATEGORIES = [
  { key: 'punctuality', label: 'Punctuality', short: 'Punct.' },
  { key: 'quality_of_care', label: 'Quality of care', short: 'Care' },
  { key: 'hygiene', label: 'Hygiene', short: 'Hygiene' },
  { key: 'behaviour', label: 'Behaviour', short: 'Behav.' },
];

export const fmt = (n, dp = 2) => (n === null || n === undefined ? '–' : Number(n).toFixed(dp));

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** YYYY-MM-DD is a calendar date; parse it as local to avoid off-by-one in IST. */
const parse = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d));

export const formatDate = (d) => (d ? dateFmt.format(parse(d)) : '–');
export const formatShortDate = (d) => (d ? shortFmt.format(parse(d)) : '–');
export const formatDateTime = (d) => (d ? dateTimeFmt.format(parse(d)) : '–');

export function relativeDays(iso) {
  const diff = Math.round((new Date(iso) - new Date()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export const toIsoDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const RANGE_PRESETS = [
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '120', label: '4 months', days: 120 },
];

export function rangeParams(presetKey) {
  const preset = RANGE_PRESETS.find((p) => p.key === presetKey) ?? RANGE_PRESETS[1];
  const to = new Date();
  const from = new Date(to.getTime() - (preset.days - 1) * 86400000);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export const npsGroup = (s) => (s >= 9 ? 'promoter' : s >= 7 ? 'passive' : 'detractor');

/** Digits only, with India country code, for wa.me links. */
export function whatsappNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
