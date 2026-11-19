export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Builds "?a=1&b=2", skipping empty values. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * fetch wrapper: JSON in/out, errors normalised to ApiError.
 * @param {string} path
 * @param {{ method?: string, body?: unknown, raw?: boolean, signal?: AbortSignal }} [opts]
 */
export async function api(path, { method = 'GET', body, raw = false, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach the server. Check your internet connection and try again.');
  }

  if (!res.ok) {
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error */
    }
    const e = payload?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `Request failed (${res.status})`, e?.fields);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}
