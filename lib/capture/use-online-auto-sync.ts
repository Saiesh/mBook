'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseOnlineAutoSyncOptions {
  onSync: () => Promise<void>;
  enabled?: boolean;
  syncOnMountWhenOnline?: boolean;
}

export function useOnlineAutoSync({
  onSync,
  enabled = true,
  syncOnMountWhenOnline = true,
}: UseOnlineAutoSyncOptions) {
  const onSyncRef = useRef(onSync);
  const syncingRef = useRef(false);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const runSync = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current) {
      return false;
    }

    // Why: online events can fire multiple times in quick succession, so we gate to one in-flight sync.
    syncingRef.current = true;
    try {
      await onSyncRef.current();
      return true;
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleOnline = () => {
      // Why: we only attempt sync when browser reports connectivity is back.
      if (!navigator.onLine) return;
      void runSync();
    };

    window.addEventListener('online', handleOnline);

    // Why: if the app opens while already online, we still want a best-effort flush of pending records.
    if (syncOnMountWhenOnline && navigator.onLine) {
      void runSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, runSync, syncOnMountWhenOnline]);

  return { runSync };
}
