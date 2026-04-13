'use client';
import React, { useRef, useEffect, useState } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierProductCard } from './supplier-product-card';
import { Skeleton } from '@/components/ui/skeleton';

type ProductListProps = {
  lenses: SupplierLens[];
  isLoading: boolean;
  onSelectLens: (lens: SupplierLens) => void;
  selectedForCompare?: SupplierLens[];
  onToggleCompare?: (lens: SupplierLens) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
};

const LOCAL_BATCH = 40;

export function SupplierProductList({
  lenses,
  isLoading,
  onSelectLens,
  selectedForCompare = [],
  onToggleCompare,
  hasMore = false,
  onLoadMore,
}: ProductListProps) {
  const [visibleCount, setVisibleCount] = useState(LOCAL_BATCH);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(LOCAL_BATCH);
  }, [lenses]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return;
        if (visibleCount < lenses.length) {
          setVisibleCount(prev => Math.min(prev + LOCAL_BATCH, lenses.length));
        } else if (hasMore && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [lenses.length, visibleCount, hasMore, onLoadMore]);

  if (isLoading && lenses.length === 0) {
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

  if (!isLoading && lenses.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center text-center h-full py-20'>
        <h3 className='text-2xl font-bold tracking-tight'>No Lenses Found</h3>
        <p className='text-muted-foreground'>Try adjusting your filters.</p>
      </div>
    );
  }

  const visibleLenses = lenses.slice(0, visibleCount);
  const showLoader = visibleCount < lenses.length || hasMore;

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
        {isLoading && lenses.length > 0 &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className='flex flex-col space-y-3'>
              <Skeleton className='h-[125px] w-full rounded-xl' />
              <div className='space-y-2'>
                <Skeleton className='h-4 w-[250px]' />
                <Skeleton className='h-4 w-[200px]' />
              </div>
            </div>
          ))
        }
      </div>
      {showLoader && (
        <div ref={loaderRef} className='flex justify-center py-8'>
          <div className='text-sm text-muted-foreground'>
            Showing {Math.min(visibleCount, lenses.length)} of{' '}
            {hasMore ? '…' : lenses.length} lenses — scroll for more
          </div>
        </div>
      )}
    </div>
  );
}