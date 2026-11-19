const DAY_MS = 24 * 60 * 60 * 1000;

export const nowIso = () => new Date().toISOString();

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS);

/** YYYY-MM-DD in UTC */
export const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10);

/**
 * Resolves a dashboard date range from query params.
 * `from`/`to` are YYYY-MM-DD (inclusive). Defaults to the last 90 days.
 */
export function resolveRange({ from, to } = {}, defaultDays = 90) {
  const end = to ? addDays(`${to}T00:00:00.000Z`, 1) : addDays(new Date(toDateOnly(new Date())), 1);
  const start = from ? new Date(`${from}T00:00:00.000Z`) : addDays(end, -defaultDays);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The window of equal length immediately before the given one, for deltas. */
export function previousRange({ start, end }) {
  const length = new Date(end).getTime() - new Date(start).getTime();
  return {
    start: new Date(new Date(start).getTime() - length).toISOString(),
    end: start,
  };
}
