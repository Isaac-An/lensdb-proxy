'use client';
import React, { useRef, useEffect } from 'react';
import { Clock, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';

type Props = {
  onSelectLens: (id: string, source: 'products' | 'supplier_lenses') => void;
};

export function RecentlyViewedButton({ onSelectLens }: Props) {
  const { recent, clearRecent } = useRecentlyViewed();
  const [open, setOpen] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(v => !v)}
        title="Recently viewed"
        className="relative"
      >
        <Clock className="h-4 w-4" />
        {recent.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-72 rounded-xl shadow-xl border bg-white overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold text-gray-700">Recently Viewed</span>
            <div className="flex items-center gap-1">
              {recent.length > 0 && (
                <button
                  onClick={clearRecent}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Clear history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-xs text-gray-400">No recently viewed lenses.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {recent.map(lens => (
                <button
                  key={lens.id}
                  onClick={() => { onSelectLens(lens.id, lens.source); setOpen(false); }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b last:border-0 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{lens.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lens.supplier && <span className="text-xs text-gray-400 truncate">{lens.supplier}</span>}
                      {lens.sensorSize && <span className="text-xs text-gray-400">{lens.sensorSize}</span>}
                      <span className="text-xs rounded px-1 py-0.5 shrink-0"
                        style={{
                          background: lens.source === 'products' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                          color: lens.source === 'products' ? 'rgb(59,130,246)' : 'rgb(16,185,129)',
                        }}>
                        {lens.source === 'products' ? 'AE-LM' : 'Supplier'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
