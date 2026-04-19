'use client';
import React from 'react';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type ProductCardProps = {
  lens: Lens;
  onSelectLens: (lens: Lens) => void;
  isSelected?: boolean;
  onToggleCompare?: (lens: Lens) => void;
  compareDisabled?: boolean;
};

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'extracted') return null;
  if (status === 'processing') return (
    <Badge variant='secondary' className='gap-1 text-xs'>
      <Loader2 className='h-3 w-3 animate-spin' />
      Processing
    </Badge>
  );
  if (status === 'failed') return (
    <Badge variant='destructive' className='text-xs'>Extraction failed</Badge>
  );
  if (status === 'needs_review') return (
    <Badge variant='outline' className='text-xs text-amber-600 border-amber-400'>Needs review</Badge>
  );
  if (status === 'needs_split_review') return (
    <Badge variant='outline' className='text-xs' style={{ color: 'rgb(99,60,180)', borderColor: 'rgb(99,60,180)' }}>Multi-sensor — review split</Badge>
  );
  return null;
}

export function ProductCard({ lens, onSelectLens, isSelected, onToggleCompare, compareDisabled }: ProductCardProps) {
  const status = lens.extractionStatus;
  const isFailed = status === 'failed';
  return (
    <Card className={'flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 ' + (isSelected ? 'ring-2 ring-primary' : '') + (isFailed ? ' border-destructive/50' : '')}>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <CardTitle className='text-base font-bold leading-snug line-clamp-2'>{lens.name}</CardTitle>
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
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className='flex-1 p-4 pt-0'>
        <div className='text-sm text-muted-foreground space-y-1'>
          {lens.sensorSize && <p><strong>Sensor:</strong> {lens.sensorSize}</p>}
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
        <Button
          variant='outline'
          className='w-full hover:bg-primary hover:text-primary-foreground hover:border-primary'
          onClick={() => onSelectLens(lens)}
          style={status === 'needs_split_review' ? { borderColor: 'rgb(99,60,180)', color: 'rgb(99,60,180)' } : {}}
        >
          {status === 'needs_split_review' ? 'Review Split' : 'View Details'}
        </Button>
      </CardFooter>
    </Card>
  );
}