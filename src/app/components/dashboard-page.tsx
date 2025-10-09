'use client';

import React, { useState, useMemo } from 'react';
import type { Lens } from '@/app/lib/types';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { collection, writeBatch, doc, getDocs, DocumentData, query, where, deleteDoc } from 'firebase/firestore';

export type Filters = {
  searchQuery: string;
  sensorSize: string;
  mountType: string;
  efl: [number | null, number | null];
  fNo: [number | null, number | null];
  fovD: [number | null, number | null];
  ttl: [number | null, number | null];
  sortOrder: 'asc' | 'desc' | 'none';
};

const initialFilters: Filters = {
  searchQuery: '',
  sensorSize: 'all',
  mountType: 'all',
  efl: [null, null],
  fNo: [null, null],
  fovD: [null, null],
  ttl: [null, null],
  sortOrder: 'none',
};

const LENS_PROPERTIES: (keyof Omit<Lens, 'id' | 'name' | 'price'>)[] = [
    'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 
    'fovH', 'fovV', 'ttl', 'tvDistortion', 'relativeIllumination', 
    'chiefRayAngle', 'mountType', 'lensStructure'
];

const NUMERIC_PROPERTIES: (keyof Lens)[] = [
    'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV', 
    'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'price'
];

function mapDocToLens(doc: DocumentData): Lens {
    const data = doc.data();
    const lens: Partial<Lens> = { id: doc.id };
  
    const propertyMapping: { [key: string]: keyof Lens } = {
      'fovDiagonal': 'fovD',
      'fovHorizontal': 'fovH',
      'fovVertical': 'fovV',
    };

    // First, map all data from the document
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const mappedKey = propertyMapping[key] || key;
        (lens as any)[mappedKey] = data[key];
      }
    }

    // Then, ensure all required properties have a default value
    const allLensKeys: (keyof Lens)[] = ['name', 'price', ...LENS_PROPERTIES];
    for (const prop of allLensKeys) {
        if ((lens as any)[prop] === undefined || (lens as any)[prop] === null) {
            if (NUMERIC_PROPERTIES.includes(prop)) {
                (lens as any)[prop] = 0;
            } else {
                (lens as any)[prop] = '';
            }
        }
    }
  
    return lens as Lens;
}

const naturalSort = (a: string, b: string) => {
    // Regex to extract the number from "AE-M<number>" or "AE-LM<number>"
    const re = /AE-(?:L)?M(\d+)/i;
    
    const aMatch = a.match(re);
    const bMatch = b.match(re);

    // If both strings match the pattern, compare them by number
    if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1], 10);
        const bNum = parseInt(bMatch[1], 10);
        if (aNum !== bNum) {
            return aNum - bNum;
        }
    }
    
    // Fallback to localeCompare for non-matching patterns or equal numbers
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};


export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();
  const { isUserLoading } = useUser();

  const productsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'products');
  }, [firestore]);
  
  const { data: rawLenses, isLoading } = useCollection<DocumentData>(productsCollection);

  const lenses = useMemo(() => {
    if (!rawLenses) return [];
    return rawLenses.map(doc => mapDocToLens({ id: doc.id, data: () => doc }));
  }, [rawLenses]);
  
  const { sensorSizes, mountTypes } = useMemo(() => {
    if (!lenses) return { sensorSizes: [], mountTypes: [] };
    const sensorSizes = [...new Set(lenses.map(l => l.sensorSize).filter(Boolean))].sort();
    const mountTypes = [...new Set(lenses.map(l => l.mountType).filter(Boolean))].sort();
    return { sensorSizes, mountTypes };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    if (!lenses) return [];
    let sortedLenses = [...lenses];

    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, ttl, sortOrder } = filters;

    if (sortOrder !== 'none') {
      sortedLenses.sort((a, b) => {
        if (sortOrder === 'asc') {
          return naturalSort(a.name, b.name);
        } else {
          return naturalSort(b.name, a.name);
        }
      });
    }

    return sortedLenses.filter(lens => {
      
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
      if (fovD[1] !== null && lens.fovD > fNo[1]) return false;
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
    if (file && firestore && productsCollection) {
      const reader = new FileReader();
      reader.onload = async (e) => {
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
          };
          
          const importedLenses = dataRows.map((row: any[]) => {
            const lensData: Partial<Lens> = {};
            normalizedHeaders.forEach((header, index) => {
              const firestoreKey = keyMap[header];
              if (firestoreKey) {
                let value = row[index];
                if (value === undefined || value === null) return;

                 if (NUMERIC_PROPERTIES.includes(firestoreKey)) {
                  value = parseFloat(value);
                  if (isNaN(value)) value = 0;
                }
                (lensData as any)[firestoreKey] = value;
              }
            });

            // Ensure all properties have a default value to prevent 'undefined' errors
            const allLensKeys: (keyof Lens)[] = ['name', 'price', ...LENS_PROPERTIES];
            for (const prop of allLensKeys) {
                if (lensData[prop] === undefined || lensData[prop] === null) {
                    if (NUMERIC_PROPERTIES.includes(prop)) {
                        (lensData as any)[prop] = 0;
                    } else {
                        (lensData as any)[prop] = '';
                    }
                }
            }

            return lensData;
          }).filter(lens => lens.name && typeof lens.name === 'string');

          if (importedLenses.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Import Warning',
              description: 'No valid lens data found in the file. Check column headers.',
            });
            return;
          }
          
          const existingDocsSnapshot = await getDocs(productsCollection);
          const existingLensNames = new Set(existingDocsSnapshot.docs.map(doc => doc.data().name));
          
          const lensesToAdd: Partial<Lens>[] = [];
          const duplicateLenses: string[] = [];

          importedLenses.forEach(newLens => {
            if (newLens.name && !existingLensNames.has(newLens.name)) {
              lensesToAdd.push(newLens);
            } else if (newLens.name) {
              duplicateLenses.push(newLens.name);
            }
          });

          if (duplicateLenses.length > 0) {
            toast({
              title: 'Duplicates Found',
              description: `${duplicateLenses.length} duplicate products were found and skipped.`
            });
          }
          
          if (lensesToAdd.length > 0) {
            const batch = writeBatch(firestore);
            lensesToAdd.forEach(newLens => {
              const newDocRef = doc(productsCollection);
              batch.set(newDocRef, newLens);
            });
            
            batch.commit()
              .then(() => {
                  toast({ title: 'Import Complete', description: `${lensesToAdd.length} new lenses imported successfully.` });
              })
              .catch((error) => {
                const permissionError = new FirestorePermissionError({
                    path: productsCollection.path,
                    operation: 'write',
                    requestResourceData: lensesToAdd
                });
                errorEmitter.emit('permission-error', permissionError);
            });
          } else if (duplicateLenses.length > 0) {
            // This case is for when there are duplicates but nothing new to add.
            // The duplicate toast is already scheduled.
          } else {
             toast({
              title: 'No New Data',
              description: 'All products in the file already exist in the database.',
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
            sensorSizes={sensorSizes}
            mountTypes={mountTypes}
          />
      </div>
      <div className="w-2/3 flex flex-col">
        <AppHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
          onImport={handleImport}
          isImportDisabled={isUserLoading}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <ProductList lenses={filteredLenses} isLoading={isLoading || isUserLoading} onSelectLens={handleSelectLens} />
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

    