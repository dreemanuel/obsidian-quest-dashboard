import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchQuests } from '../lib/api.js';

const POLL_INTERVAL_MS = 60_000;

export function useQuests() {
  const [data, setData] = useState({ quests: [], categories: [], meta: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchQuests();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [refetch]);

  return { ...data, loading, error, refetch };
}
