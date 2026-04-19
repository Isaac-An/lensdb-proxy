'use client';
import React from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

type ProductCardProps = {
  lens: SupplierLens;
  onSelectLens: (lens: SupplierLens) => void;
  isSelected?: boolean;
  onToggleCompare?: (lens: SupplierLens) => void;
  compareDisabled?: boolean;
};

// If sensorSize is a plain number (bad AI extraction), don't display it
function sanitizeSensorSize(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return null;
  return str;
}

export function SupplierProductCard({ lens, onSelectLens, isSelected, onToggleCompare, compareDisabled }: ProductCardProps) {
  const sensorDisplay = sanitizeSensorSize(lens.sensorSize);

  return (
    <Card className={'flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 ' + (isSelected ? 'ring-2 ring-primary' : '')}>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <CardTitle className='text-base font-bold leading-snug line-clamp-2'>{lens.name}</CardTitle>
            {lens.supplier && <Badge variant='secondary' className='mt-1 text-xs'>{lens.supplier}</Badge>}
            {lens.countryOfOrigin && <span className='ml-1 text-xs text-muted-foreground'>{lens.countryOfOrigin}</span>}
          </div>
          {onToggleCompare && (
            <div className='flex items-center gap-1.5 shrink-0' onClick={e => e.stopPropagation()}>
              <Checkbox
                id={'compare-' + lens.id}
                checked={isSelected}
                disabled={compareDisabled && !isSelected}
                onCheckedChange={() => onToggleCompare(lens)}
              />
              <label htmlFor={'compare-' + lens.id} className='text-xs text-muted-foreground cursor-pointer select-none'>Compare</label>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className='flex-1 p-4 pt-0'>
        <div className='text-sm text-muted-foreground space-y-1'>
          {sensorDisplay && <p><strong>Sensor:</strong> {sensorDisplay}</p>}
          <p><strong>EFL:</strong> {lens.efl || '-'}mm</p>
          <p><strong>F. No.:</strong> {lens.fNo || '-'}</p>
          {lens.maxImageCircle && <p><strong>Image Circle:</strong> {lens.maxImageCircle}mm</p>}
          {lens.fovH ? <p><strong>HFOV:</strong> {lens.fovH}°</p> : lens.fovD ? <p><strong>DFOV:</strong> {lens.fovD}°</p> : null}
          <p><strong>Mount:</strong> {lens.mountType || '-'}</p>
          {lens.ttl && <p><strong>TTL:</strong> {lens.ttl}mm</p>}
          {lens.price && <p><strong>Price:</strong> {lens.price}</p>}
        </div>
      </CardContent>
      <CardFooter className='p-4 pt-0'>
        <Button variant='outline' className='w-full hover:bg-primary hover:text-primary-foreground hover:border-primary' onClick={() => onSelectLens(lens)}>View Details</Button>
      </CardFooter>
    </Card>
  );
}
