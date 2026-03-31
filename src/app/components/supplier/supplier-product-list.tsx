'use client';
import React, { useRef, useCallback } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierProductCard } from './supplier-product-card';
import { Skeleton } from '@/components/ui/skeleton';

type ProductListProps = {
  lenses: SupplierLens[];
  isLoading: boolean;
  onSelectLens: (lens: SupplierLens) => void;
  selectedForCompare?: SupplierLens[];
  onToggleCompare?: (lens: SupplierLens) => void;
};

const BATCH_SIZE = 40;

export function SupplierProductList({ lenses, isLoading, onSelectLens, selectedForCompare = [], onToggleCompare }: ProductListProps) {
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => { setVisibleCount(BATCH_SIZE); }, [lenses]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + BATCH_SIZE, lenses.length));
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [lenses.length]);

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className='flex flex-col space-y-3'>
            <Skeleton className='h-[125px] w-full rounded-xl' />
            <div className='space-y-2'>
              <Skeleton className='h-4 w-[250px]' />
              <Skeleton className='h-4 w-[200px]' />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lenses.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center text-center h-full py-20'>
        <h3 className='text-2xl font-bold tracking-tight'>No Lenses Found</h3>
        <p className='text-muted-foreground'>Try adjusting your filters.</p>
      </div>
    );
  }

  const visibleLenses = lenses.slice(0, visibleCount);

  return (
    <div>
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {visibleLenses.map(lens => (
          <SupplierProductCard
            key={lens.id}
            lens={lens}
            onSelectLens={onSelectLens}
            isSelected={selectedForCompare.some(l => l.id === lens.id)}
            onToggleCompare={onToggleCompare}
            compareDisabled={selectedForCompare.length >= 3}
          />
        ))}
      </div>
      {visibleCount < lenses.length && (
        <div ref={loaderRef} className='flex justify-center py-8'>
          <div className='text-sm text-muted-foreground'>
            Showing {visibleCount} of {lenses.length} lenses — scroll for more
          </div>
        </div>
      )}
    </div>
  );
}