
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UpdateConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lensesToUpdate: { current: Lens; updated: Lens }[];
}

const keysToDisplay: (keyof Lens)[] = [
    'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV',
    'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'mountType',
    'lensStructure', 'pdfUrl', 'price'
];

export function UpdateConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  lensesToUpdate,
}: UpdateConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Lens Updates</AlertDialogTitle>
          <AlertDialogDescription>
            The following lenses have changed. Please review the changes and confirm if you want to update them in the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ScrollArea className="h-[60vh] pr-6">
          <div className="space-y-6">
            {lensesToUpdate.map(({ current, updated }, index) => (
              <div key={current.id}>
                <h3 className="text-lg font-semibold mb-2">{current.name}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Property</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>New Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysToDisplay.map(key => {
                        const currentValue = current[key] ?? 'N/A';
                        const updatedValue = updated[key] ?? 'N/A';
                        const isDifferent = currentValue?.toString() !== updatedValue?.toString();

                        if (!isDifferent) return null;

                        return (
                            <TableRow key={key}>
                                <TableCell className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                                <TableCell>{currentValue.toString()}</TableCell>
                                <TableCell className="text-accent-foreground bg-accent/30">{updatedValue.toString()}</TableCell>
                            </TableRow>
                        );
                    })}
                  </TableBody>
                </Table>
                {index < lensesToUpdate.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm Updates</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
