'use client';
import React from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

type ProductDetailsProps = {
  lens: SupplierLens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const formatValue = (value: string | number | undefined | null, unit: string = '') => {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  return `${value}${unit}`;
};

export function SupplierProductDetails({ lens, open, onOpenChange }: ProductDetailsProps) {
  if (!lens) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='sm:max-w-lg w-[90vw] overflow-y-auto'>
        <SheetHeader className='text-left'>
          <SheetTitle className='text-2xl'>{lens.name}</SheetTitle>
          <SheetDescription>Detailed specifications for {lens.name}.</SheetDescription>
          <div className='flex gap-2 mt-2 flex-wrap'>
            {lens.supplier && <Badge variant='outline'>{lens.supplier}</Badge>}
            {lens.countryOfOrigin && <Badge variant='secondary'>{lens.countryOfOrigin}</Badge>}
          </div>
        </SheetHeader>
        <div className='py-6 space-y-4'>
          <DetailItem label='Sensor Size' value={lens.sensorSize} />
          <Separator />
          <DetailItem label='EFL' value={formatValue(lens.efl, ' mm')} />
          <DetailItem label='Max image circle' value={formatValue(lens.maxImageCircle, ' mm')} />
          <DetailItem label='F. No.' value={formatValue(lens.fNo)} />
          <DetailItem label='Diagonal FOV' value={formatValue(lens.fovD, '°')} />
          <DetailItem label='Horizontal FOV' value={formatValue(lens.fovH, '°')} />
          <DetailItem label='Vertical FOV' value={formatValue(lens.fovV, '°')} />
          <Separator />
          <DetailItem label='TTL' value={formatValue(lens.ttl, ' mm')} />
          <DetailItem label='TV distortion' value={formatValue(lens.tvDistortion, '%')} />
          <DetailItem label='Relative illumination' value={formatValue(lens.relativeIllumination, '%')} />
          <DetailItem label='Chief ray angle' value={formatValue(lens.chiefRayAngle, '°')} />
          <Separator />
          <DetailItem label='Mount type' value={lens.mountType} />
          <DetailItem label='Lens structure' value={lens.lensStructure} />
          {lens.price && <><Separator /><DetailItem label='Price' value={lens.price} /></>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className='flex justify-between items-center'>
    <p className='text-sm text-muted-foreground'>{label}</p>
    <p className='text-sm font-medium text-foreground'>{formatValue(value as string)}</p>
  </div>
);