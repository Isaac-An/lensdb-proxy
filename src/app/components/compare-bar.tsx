'use client';

import React from 'react';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { X, GitCompare } from 'lucide-react';

type CompareBarProps = {
  selected: Lens[];
  onRemove: (id: string) => void;
  onCompare: () => void;
  onClear: () => void;
};

export function CompareBar({ selected, onRemove, onCompare, onClear }: CompareBarProps) {
  if (selected.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border rounded-xl shadow-lg px-4 py-3">
      <span className="text-sm text-muted-foreground font-medium">Compare:</span>
      {selected.map(lens => (
        <div key={lens.id} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-sm">
          <span className="max-w-32 truncate">{lens.name}</span>
          <button onClick={() => onRemove(lens.id)} className="text-muted-foreground hover:text-foreground ml-1">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {selected.length < 3 && (
        <span className="text-xs text-muted-foreground">
          {3 - selected.length} more slot{3 - selected.length !== 1 ? 's' : ''}
        </span>
      )}
      <Button size="sm" onClick={onCompare} disabled={selected.length < 2}>
        <GitCompare className="h-4 w-4 mr-1" />
        Compare ({selected.length})
      </Button>
      <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
