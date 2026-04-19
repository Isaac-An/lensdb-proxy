'use client';
import { Input } from '@/components/ui/input';
import { Search, FileInput } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import type { SupplierLens } from '@/app/lib/types';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SupplierHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  children?: React.ReactNode;
  onImportComplete?: () => void;
};

const normalizeHeader = (header: string) =>
  typeof header === 'string' ? header.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

const keyMap: Record<string, string> = {
  productname: 'name', name: 'name',
  sensorsize: 'sensorSize',
  eflmm: 'efl', efl: 'efl',
  maximagecirclemm: 'maxImageCircle', maximagecircle: 'maxImageCircle',
  fno: 'fNo',
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
  supplier: 'supplier', suppliername: 'supplier',
  brand: 'supplier', manufacturer: 'supplier',
  countryoforigin: 'countryOfOrigin', origin: 'countryOfOrigin',
  country: 'countryOfOrigin', madein: 'countryOfOrigin',
  industrial: 'industrial',
};

export function SupplierHeader({
  searchQuery,
  onSearchChange,
  children,
  onImportComplete,
}: SupplierHeaderProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedLenses, setParsedLenses] = useState<Partial<SupplierLens>[] | null>(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length < 2) {
          toast({ variant: 'destructive', title: 'Import Error', description: 'Spreadsheet is empty.' });
          return;
        }
        const headers = json[0].map(normalizeHeader);
        const lenses = json.slice(1)
          .map((row: any[]) => {
            const lens: any = {};
            headers.forEach((h: string, i: number) => {
              const key = keyMap[h];
              if (key) lens[key] = row[i] !== null && row[i] !== undefined ? String(row[i]) : '';
            });
            return lens as Partial<SupplierLens>;
          })
          .filter(l => l.name && l.name.trim() !== '');

        if (lenses.length === 0) {
          toast({ variant: 'destructive', title: 'Import Warning', description: 'No valid lens rows found.' });
          return;
        }
        setParsedLenses(lenses);
        setConfirmOpen(true);
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!firestore || !parsedLenses) return;
    setConfirmOpen(false);
    setIsImporting(true);
    toast({ title: 'Importing...', description: 'Checking for changes, please wait.' });

    try {
      const col = collection(firestore, 'supplier_lenses');

      // Fetch all existing docs, index by name
      const existingSnap = await getDocs(col);
      const existingByName = new Map<string, { id: string; data: any }>();
      existingSnap.docs.forEach(d => {
        const n = (d.data().name || '').trim();
        if (n) existingByName.set(n, { id: d.id, data: d.data() });
      });

      const IGNORE = new Set(['updatedAt', 'createdAt', 'syncedFromSheet', 'id', 'pdfUrl', 'price', 'extractionStatus', 'sourcePath']);
      let inserted = 0, updated = 0, skipped = 0;

      const BATCH_SIZE = 500;
      for (let i = 0; i < parsedLenses.length; i += BATCH_SIZE) {
        const chunk = parsedLenses.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);

        for (const lens of chunk) {
          const name = (lens.name || '').trim();
          if (!name) continue;

          const existing = existingByName.get(name);

          if (!existing) {
            // New lens — insert
            const ref = doc(col);
            batch.set(ref, { ...lens, id: ref.id });
            inserted++;
          } else {
            // Check for differences (ignore metadata fields)
            const csvKeys = Object.keys(lens).filter(k => !IGNORE.has(k));
            const hasDiff = csvKeys.some(k => {
              const csvVal = String((lens as any)[k] ?? '').trim();
              const fsVal = String(existing.data[k] ?? '').trim();
              return csvVal !== '' && csvVal !== fsVal;
            });

            if (hasDiff) {
              // Update existing doc, preserve metadata
              const ref = doc(col, existing.id);
              batch.set(ref, { ...existing.data, ...lens, id: existing.id }, { merge: true });
              updated++;
            } else {
              skipped++;
            }
          }
        }

        await batch.commit();
      }

      toast({
        title: 'Import Complete',
        description: `✅ ${inserted} inserted · 🔄 ${updated} updated · ⏭ ${skipped} unchanged`,
      });
      onImportComplete?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
    } finally {
      setIsImporting(false);
      setParsedLenses(null);
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold md:text-xl whitespace-nowrap">
          Appleye Unified Supplier Lenses
        </h1>
        <Button asChild variant="outline" size="sm">
          <a href="/">My Database</a>
        </Button>
      </div>
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </form>

        <Button
          size="sm"
          variant="outline"
          disabled={isImporting}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileInput className="mr-2 h-4 w-4" />
          {isImporting ? 'Importing...' : 'Import CSV'}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".xlsx,.xls,.csv"
        />

        {children}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {parsedLenses?.length} lenses</AlertDialogTitle>
            <AlertDialogDescription>
              New lenses will be inserted. Existing lenses with changed data will be updated. Unchanged lenses will be skipped. No data will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleImport}>Import</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}