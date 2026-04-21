'use client';
import { useState, useEffect, useCallback } from 'react';

export type RecentLens = {
  id: string;
  name: string;
  supplier?: string;
  sensorSize?: string | null;
  source: 'products' | 'supplier_lenses';
};

const KEY = 'appleye_recently_viewed';
const MAX = 10;

export function useRecentlyViewed() {
  const [recent, setRecent] = useState<RecentLens[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch {}
  }, []);

  const addRecent = useCallback((lens: RecentLens) => {
    setRecent(prev => {
      const filtered = prev.filter(l => l.id !== lens.id);
      const next = [lens, ...filtered].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return { recent, addRecent, clearRecent };
}
