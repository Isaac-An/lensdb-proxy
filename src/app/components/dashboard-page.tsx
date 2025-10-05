'use client';

import React, { useState, useMemo } from 'react';
import { SENSOR_SIZES, MOUNT_TYPES } from '@/app/lib/data';
import type { Lens } from '@/app/lib/types';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs, deleteDoc } from 'firebase/firestore';

export type Filters = {
  searchQuery: string;
  sensorSize: string;
  mountType: string;
  efl: [number | null, number | null];
  fNo: [number | null, number | null];
  fovD: [number | null, number | null];
  ttl: [number | null, number | null];
};

const initialFilters: Filters = {
  searchQuery: '',
  sensorSize: 'all',
  mountType: 'all',
  efl: [null, null],
  fNo: [null, null],
  fovD: [null, null],
  ttl: [null, null],
};

const LENS_PROPERTIES: (keyof Omit<Lens, 'id'>)[] = [
  'name', 'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 
  'fovH', 'fovV', 'ttl', 'tvDistortion', 'relativeIllumination', 
  'chiefRayAngle', 'mountType', 'lensStructure'
];

const NUMERIC_PROPERTIES: (keyof Lens)[] = [
    'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV', 
    'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle'
];


export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();
  const productsCollection = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: lenses, isLoading } = useCollection<Lens>(productsCollection);

  const filteredLenses = useMemo(() => {
    if (!lenses) return [];
    return lenses.filter(lens => {
      const { searchQuery, sensorSize, mountType, efl, fNo, fovD, ttl } = filters;
      
      if (searchQuery && !lens.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (sensorSize !== 'all' && lens.sensorSize !== sensorSize) {
        return false;
      }
      if (mountType !== 'all' && lens.mountType !== mountType) {
        return false;
      }
      if (efl[0] !== null && lens.efl < efl[0]) return false;
      if (efl[1] !== null && lens.efl > efl[1]) return false;
      if (fNo[0] !== null && lens.fNo < fNo[0]) return false;
      if (fNo[1] !== null && lens.fNo > fNo[1]) return false;
      if (fovD[0] !== null && lens.fovD < fovD[0]) return false;
      if (fovD[1] !== null && lens.fovD > fovD[1]) return false;
      if (ttl[0] !== null && lens.ttl < ttl[0]) return false;
      if (ttl[1] !== null && lens.ttl > ttl[1]) return false;
      
      return true;
    });
  }, [filters, lenses]);

  const handleSelectLens = (lens: Lens) => {
    setSelectedLens(lens);
    setDetailsOpen(true);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const header = json[0] as string[];
          const propMap: { [key: string]: number } = {};
          header.forEach((h, i) => {
            const propName = h === 'F. No.' ? 'fNo' : LENS_PROPERTIES.find(p => p.toLowerCase() === h.toLowerCase());
            if (propName) {
              propMap[propName] = i;
            }
          });

          const importedLenses: Omit<Lens, 'id'>[] = json.slice(1).map((row: any[]) => {
            const lensData: Partial<Omit<Lens, 'id'>> = {};
            for (const prop of LENS_PROPERTIES) {
                const colIndex = propMap[prop];
                if (colIndex !== undefined && row[colIndex] !== undefined && row[colIndex] !== null) {
                    const value = row[colIndex];
                    if (NUMERIC_PROPERTIES.includes(prop as any)) {
                        const numValue = parseFloat(String(value));
                        (lensData as any)[prop] = isNaN(numValue) ? 0 : numValue;
                    } else {
                        (lensData as any)[prop] = value;
                    }
                }
            }

            for (const prop of NUMERIC_PROPERTIES) {
                if (lensData[prop] === undefined) {
                    (lensData as any)[prop] = 0;
                }
            }

            return lensData as Omit<Lens, 'id'>;

          }).filter(lens => lens.name && typeof lens.name === 'string');

          if (importedLenses.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Import Warning',
              description: 'No valid lens data found in the file.',
            });
            return;
          }
          
          const batch = writeBatch(firestore);

          // Clear existing lenses
          const existingDocs = await getDocs(productsCollection);
          existingDocs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          let addedCount = 0;
          importedLenses.forEach(newLens => {
            const newDocRef = doc(productsCollection);
            batch.set(newDocRef, newLens);
            addedCount++;
          });

          await batch.commit();
          toast({ title: 'Import Complete', description: `${addedCount} lenses imported successfully.` });

        } catch (error) {
          console.error("Failed to import and parse file:", error);
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: 'Could not read, parse the file, or save to database.',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="w-1/3 border-r">
          <FilterSidebar 
            filters={filters} 
            setFilters={setFilters} 
            resetFilters={() => setFilters(initialFilters)}
            sensorSizes={SENSOR_SIZES}
            mountTypes={MOUNT_TYPES}
          />
      </div>
      <div className="w-2/3 flex flex-col">
        <AppHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
          onImport={handleImport}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <ProductList lenses={filteredLenses} isLoading={isLoading} onSelectLens={handleSelectLens} />
        </main>
      </div>

      {selectedLens && (
        <ProductDetails 
          lens={selectedLens} 
          open={isDetailsOpen} 
          onOpenChange={setDetailsOpen} 
        />
      )}
      
    </div>
  );
}
