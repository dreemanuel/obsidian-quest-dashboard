import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'qd:show-completed';

export function useShowCompleted() {
  const [show, setShow] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(show));
    } catch {
      // ignore
    }
  }, [show]);

  const toggle = useCallback(() => setShow(s => !s), []);

  return { show, toggle };
}
