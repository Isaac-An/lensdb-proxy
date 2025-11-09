
'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileInput, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import type { Lens } from '@/app/lib/types';

interface ExcelImportProps {
  onImport: (lenses: Lens[]) => void;
  onAppend: (lenses: Lens[]) => void;
}

const LENS_PROPERTIES: (keyof Omit<Lens, 'id' | 'name' | 'price'>)[] = [
    'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 
    'fovH', 'fovV', 'ttl', 'tvDistortion', 'relativeIllumination', 
    'chiefRayAngle', 'mountType', 'lensStructure', 'pdfUrl'
];

const NUMERIC_PROPERTIES: (keyof Lens)[] = [
    'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV', 
    'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'price'
];

export function ExcelImport({ onImport, onAppend }: ExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, mode: 'import' | 'append') => {
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

        const importedLenses = dataRows.map((row: any[], index: number) => {
          const lensData: Partial<Lens> = {};
          normalizedHeaders.forEach((header, index) => {
            const firestoreKey = keyMap[header];
            if (firestoreKey) {
              let value = row[index];
              if (value === undefined || value === null) return;

              if (NUMERIC_PROPERTIES.includes(firestoreKey)) {
                value = parseFloat(value);
                if (isNaN(value)) value = null;
              }
              (lensData as any)[firestoreKey] = value;
            }
          });
          return lensData;
        })
        .filter(lens => lens.name && typeof lens.name === 'string')
        .map((lens, index) => {
            const completeLens: Partial<Lens> = { id: `imported-${Date.now()}-${index}`, ...lens };
            const allLensKeys: (keyof Lens)[] = ['name', 'price', ...LENS_PROPERTIES];
            for (const prop of allLensKeys) {
                if (completeLens[prop] === undefined || completeLens[prop] === null) {
                    if (NUMERIC_PROPERTIES.includes(prop)) {
                        (completeLens as any)[prop] = null;
                    } else {
                        (completeLens as any)[prop] = '';
                    }
                }
            }
            return completeLens as Lens;
        });

        if (importedLenses.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Import Warning',
              description: 'No valid lens data with product names found in the file.',
            });
            return;
        }

        if (mode === 'import') {
            onImport(importedLenses);
        } else {
            onAppend(importedLenses);
        }

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

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => fileInputRef.current?.click()}>
        <FileInput />
        Import & Replace
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
        <Plus />
        Append Data
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e, e.shiftKey ? 'append' : 'import')} // A bit of a hack: hold shift to append
        className="hidden"
        accept=".xlsx, .xls, .csv"
      />
    </div>
  );
}
