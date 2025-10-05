'use client';

import React from 'react';
import type { Lens } from '@/app/lib/types';
import { ProductCard } from './product-card';
import { Skeleton } from '@/components/ui/skeleton';

type ProductListProps = {
  lenses: Lens[];
  isLoading: boolean;
  onSelectLens: (lens: Lens) => void;
};

export function ProductList({ lenses, isLoading, onSelectLens }: ProductListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col space-y-3">
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <h3 className="text-2xl font-bold tracking-tight">No Lenses Found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria, or import an Excel file.</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {lenses.map((lens) => (
        <ProductCard key={lens.id} lens={lens} onSelectLens={onSelectLens} />
      ))}
    </div>
  );
}
