
'use client';

import React from 'react';
import type { Lens } from '@/app/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export type LensForUpdate = {
  id: string;
  name: string;
  newData: Partial<Lens>;
};

type UpdateConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lensesToUpdate: LensForUpdate[];
  onConfirm: () => void;
  onCancel: () => void;
};

const friendlyKeyNames: Record<string, string> = {
    sensorSize: 'Sensor Size',
    efl: 'EFL (mm)',
    maxImageCircle: 'Max Image Circle (mm)',
    fNo: 'F. No.',
    fovD: 'Diagonal FOV (°)',
    fovH: 'Horizontal FOV (°)',
    fovV: 'Vertical FOV (°)',
    ttl: 'TTL (mm)',
    tvDistortion: 'TV Distortion (%)',
    relativeIllumination: 'Relative Illumination (%)',
    chiefRayAngle: 'Chief Ray Angle (°)',
    mountType: 'Mount Type',
    lensStructure: 'Lens Structure',
    price: 'Price'
};

export function UpdateConfirmationDialog({
  open,
  onOpenChange,
  lensesToUpdate,
  onConfirm,
  onCancel,
}: UpdateConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Existing Products?</AlertDialogTitle>
          <AlertDialogDescription>
            Found {lensesToUpdate.length} product(s) in your database that are missing information. Do you want to update them with the new data from your file?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="max-h-60 w-full rounded-md border p-4">
            <div className="space-y-4">
            {lensesToUpdate.map((lens, index) => (
                <div key={lens.id}>
                    <h4 className="font-semibold text-sm mb-2">{lens.name}</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {Object.entries(lens.newData).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center">
                                <span className="text-muted-foreground">{friendlyKeyNames[key] || key}:</span>
                                <Badge variant="secondary" className="font-mono">{String(value)}</Badge>
                            </div>
                        ))}
                    </div>
                    {index < lensesToUpdate.length - 1 && <Separator className="mt-4" />}
                </div>
            ))}
            </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Update</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
