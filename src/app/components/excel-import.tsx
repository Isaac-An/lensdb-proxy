
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

const LENS_PROPERTIES: (keyof Omit<Lens, 'id' | 'name' | 'price'>)[] = [
    'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 
    'fovH', 'fovV', 'ttl', 'tvDistortion', 'relativeIllumination', 
    'chiefRayAngle', 'mountType', 'lensStructure', 'pdfUrl'
];

const POTENTIALLY_STRING_PROPERTIES: (keyof Lens)[] = [
    'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV', 
    'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'price'
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

        const keyMap: { [key: string]: keyof Lens } = {
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
        };

        const lensesFromFile = dataRows.map((row: any[], index: number) => {
            const lensData: Partial<Lens> = {};
            normalizedHeaders.forEach((header, colIndex) => {
              const firestoreKey = keyMap[header];
              if (firestoreKey) {
                let value = row[colIndex];
                
                if (value === undefined || value === null) {
                    (lensData as any)[firestoreKey] = '';
                    return;
                };
  
                (lensData as any)[firestoreKey] = String(value).trim();
              }
            });
            return lensData;
        })
        .filter(lens => lens.name && typeof lens.name === 'string' && lens.name.trim() !== '')
        .map((lens, index) => {
            const completeLens: Partial<Lens> = { id: `imported-${Date.now()}-${index}`, ...lens };
            const allLensKeys: (keyof Lens)[] = ['name', 'price', ...LENS_PROPERTIES];
            for (const prop of allLensKeys) {
                if (completeLens[prop] === undefined || completeLens[prop] === null) {
                    (completeLens as any)[prop] = '';
                }
            }
            return completeLens as Lens;
        });

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
