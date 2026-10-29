import { useState, useCallback, useEffect } from 'react';

export type DemoState = 'welcome' | 'demo' | 'own';

const STORAGE_KEY = 'eidos_demo_state';
const ITEMS_COUNT_KEY = 'eidos_own_items_count';

export interface DemoStateHook {
  state: DemoState;
  ownItemsCount: number;
  setDemoState: (state: DemoState, itemsCount?: number) => void;
  resetToWelcome: () => void;
}

export function useDemoState(): DemoStateHook {
  const [state, setState] = useState<DemoState>(() => {
    if (typeof window === 'undefined') return 'welcome';
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DemoState | null;
      return saved === 'demo' || saved === 'own' ? saved : 'welcome';
    } catch {
      return 'welcome';
    }
  });

  const [ownItemsCount, setOwnItemsCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem(ITEMS_COUNT_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, state);
        localStorage.setItem(ITEMS_COUNT_KEY, String(ownItemsCount));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [state, ownItemsCount]);

  const setDemoState = useCallback((newState: DemoState, itemsCount?: number) => {
    setState(newState);
    if (itemsCount !== undefined) {
      setOwnItemsCount(itemsCount);
    }
  }, []);

  const resetToWelcome = useCallback(() => {
    setState('welcome');
    setOwnItemsCount(0);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ITEMS_COUNT_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  return {
    state,
    ownItemsCount,
    setDemoState,
    resetToWelcome,
  };
}
