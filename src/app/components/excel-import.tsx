'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileInput } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
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

interface ExcelImportProps {
  onAppend: (lenses: Lens[]) => void;
  onReplace: (lenses: Lens[]) => void;
  isDisabled: boolean;
}

const allLensKeys: (keyof Lens)[] = [
    'id', 'name', 'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD',
    'fovH', 'fovV', 'ttl', 'tvDistortion', 'relativeIllumination',
    'chiefRayAngle', 'mountType', 'lensStructure', 'price', 'pdfUrl',
    'countryOfOrigin',
];

export function ExcelImport({ onAppend, onReplace, isDisabled }: ExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedLenses, setImportedLenses] = useState<Lens[] | null>(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
          toast({ variant: 'destructive', title: 'Import Error', description: 'Spreadsheet is empty.'});
          return;
        }

        const headerRow = json[0];
        const dataRows = json.slice(1);

        const normalizeHeader = (header: string) =>
            typeof header === 'string' ? header.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

        const normalizedHeaders = headerRow.map(normalizeHeader);

        const keyMap: { [key: string]: keyof Lens | 'supplier' | 'countryOfOrigin' } = {
          productname: 'name', name: 'name',
          sensorsize: 'sensorSize',
          eflmm: 'efl', efl: 'efl',
          maximagecirclemm: 'maxImageCircle', maximagecircle: 'maxImageCircle',
          fno: 'fNo', f: 'fNo',
          fovdiagonal: 'fovD', fovd: 'fovD', fov: 'fovD',
          fovhorizontal: 'fovH', fovh: 'fovH',
          fovvertical: 'fovV', fovv: 'fovV',
          ttlmm: 'ttl', ttl: 'ttl',
          tvdistortion: 'tvDistortion',
          relativeillumination: 'relativeIllumination',
          chiefrayangle: 'chiefRayAngle',
          mounttype: 'mountType', mount: 'mountType',
          lensstructure: 'lensStructure',
          price: 'price',
          pdfurl: 'pdfUrl', pdf: 'pdfUrl',
          // Supplier and origin columns
          supplier: 'supplier' as any,
          suppliername: 'supplier' as any,
          brand: 'supplier' as any,
          manufacturer: 'supplier' as any,
          countryoforigin: 'countryOfOrigin',
          origin: 'countryOfOrigin',
          country: 'countryOfOrigin',
          madein: 'countryOfOrigin',
        };

        const lensesFromFile = dataRows.map((row: any[], rowIndex) => {
            const lensData: Partial<Lens> = { id: `imported-${Date.now()}-${rowIndex}` };

            normalizedHeaders.forEach((header, colIndex) => {
              const firestoreKey = keyMap[header];
              if (firestoreKey) {
                const value = row[colIndex];
                (lensData as any)[firestoreKey] = (value === null || value === undefined) ? '' : String(value);
              }
            });

            // Ensure all properties exist, even if empty
            for (const prop of allLensKeys) {
                if (!(prop in lensData)) {
                    (lensData as any)[prop] = '';
                }
            }

            return lensData as Lens;
        })
        .filter(lens => lens.name && lens.name.trim() !== '');

        if (lensesFromFile.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Import Warning',
              description: 'No valid lens data with product names found in the file.',
            });
            return;
        }

        setImportedLenses(lensesFromFile);
        setConfirmOpen(true);

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error.message || 'An unexpected error occurred during import.',
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = (action: 'replace' | 'append') => {
    if (!importedLenses) return;
    if (action === 'replace') {
      onReplace(importedLenses);
    } else {
      onAppend(importedLenses);
    }
    setConfirmOpen(false);
    setImportedLenses(null);
  };

  return (
    <>
      <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isDisabled}>
        <FileInput />
        Import Data
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".xlsx, .xls, .csv"
      />

      <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>How do you want to import this file?</AlertDialogTitle>
            <AlertDialogDescription>
              You can either replace the entire database with this new file, or append new lenses and update existing ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => handleConfirm('append')}>Append Data</Button>
            <AlertDialogAction onClick={() => handleConfirm('replace')}>Import & Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
