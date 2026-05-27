import { useState, useEffect, useCallback } from 'react';
import { getSetupStatus } from '../lib/setupApi.js';

export function useSetupStatus() {
  const [status, setStatus] = useState({ setupNeeded: false, sources: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const result = await getSetupStatus();
      setStatus({ setupNeeded: result.setupNeeded, sources: result.sources, loading: false, error: null });
    } catch (err) {
      setStatus(prev => ({ ...prev, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, refresh };
}
