import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Loads `path` and reloads whenever it changes. Pass null to skip.
 * Keeps showing the previous data while a new request is in flight, so filters don't flash empty.
 */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, error, loading: false }));
      });
    return () => controller.abort();
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}
