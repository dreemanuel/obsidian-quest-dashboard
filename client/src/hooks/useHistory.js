import { useEffect, useState, useCallback } from 'react';
import { fetchHistory } from '../lib/api.js';

const POLL_INTERVAL_MS = 60_000;

export function useHistory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchHistory();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  return { history: data, error, refetch };
}
