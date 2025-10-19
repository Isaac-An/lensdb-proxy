
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
import { collection, writeBatch, doc, getDocs, DocumentData } from 'firebase/firestore';
import { UpdateConfirmationDialog, type LensForUpdate } from './update-confirmation-dialog';

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
    const re = /AE-(L?M)(\d+)/i;
    
    const aMatch = a.match(re);
    const bMatch = b.match(re);

    if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[2], 10);
        const bNum = parseInt(bMatch[2], 10);
        if (aNum !== bNum) {
            return aNum - bNum;
        }
    }
    
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const normalizeSensorSize = (size: string) => (typeof size === 'string' ? size.replace(/''/g, '"') : '');


export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [lensesToUpdate, setLensesToUpdate] = useState<LensForUpdate[]>([]);
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);

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
    
    const customSensorSort = (a: string, b: string) => {
      const regex = /(\d+)\/(\d+(\.\d+)?)/;
      const matchA = a.match(regex);
      const matchB = b.match(regex);

      if (matchA && matchB) {
        const valA = parseInt(matchA[1]) / parseFloat(matchA[2]);
        const valB = parseInt(matchB[1]) / parseFloat(matchB[2]);
        if (valA !== valB) {
          return valB - valA; 
        }
      }
      return a.localeCompare(b);
    };
    
    const uniqueSensorSizes = [...new Set(lenses.map(l => normalizeSensorSize(l.sensorSize)).filter(Boolean))];
    const sortedSensorSizes = uniqueSensorSizes.sort(customSensorSort);
    const mountTypes = [...new Set(lenses.map(l => l.mountType).filter(Boolean))].sort();
    return { sensorSizes: sortedSensorSizes, mountTypes };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    if (!lenses) return [];
  
    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, ttl, sortOrder } = filters;
  
    let processedLenses = [...lenses];
  
    if (sortOrder !== 'none') {
      processedLenses.sort((a, b) => {
        if (sortOrder === 'asc') {
          return naturalSort(a.name, b.name);
        } else {
          return naturalSort(b.name, a.name);
        }
      });
    }
    
    return processedLenses.filter(lens => {
      // Search Query Filter
      if (searchQuery && !lens.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Sensor Size Filter
      if (sensorSize !== 'all' && !lens.name.trim().startsWith(sensorSize)) {
        return false;
      }
      
      // Mount Type Filter
      if (mountType !== 'all' && lens.mountType !== mountType) {
        return false;
      }
  
      // Numeric Range Filters
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
  
  const handleConfirmUpdate = async () => {
    if (!firestore || lensesToUpdate.length === 0) return;
  
    const batch = writeBatch(firestore);
    lensesToUpdate.forEach(item => {
      const docRef = doc(firestore, 'products', item.id);
      batch.update(docRef, item.newData);
    });
  
    batch.commit()
      .then(() => {
        toast({
          title: 'Update Complete',
          description: `${lensesToUpdate.length} lens(es) updated successfully.`,
        });
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: 'products', // Simplified path for batch operation
          operation: 'write',
          requestResourceData: lensesToUpdate.map(l => l.newData)
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  
    setUpdateConfirmOpen(false);
    setLensesToUpdate([]);
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
          
          const fileLenses = dataRows.map((row: any[]) => {
            const lensData: Partial<Lens> = {};
            normalizedHeaders.forEach((header, index) => {
              const firestoreKey = keyMap[header];
              if (firestoreKey) {
                let value = row[index];
                if (value === undefined || value === null) return;

                 if (NUMERIC_PROPERTIES.includes(firestoreKey)) {
                  value = parseFloat(value);
                  if (isNaN(value)) value = null; // Use null for blank numeric cells
                }
                (lensData as any)[firestoreKey] = value;
              }
            });
            return lensData;
          }).filter(lens => lens.name && typeof lens.name === 'string');

          if (fileLenses.length === 0) {
            toast({
              variant: 'destructive',
              title: 'Import Warning',
              description: 'No valid lens data found in the file. Check column headers.',
            });
            return;
          }

          const existingLensesSnapshot = await getDocs(productsCollection);
          const existingLensesMap = new Map(existingLensesSnapshot.docs.map(doc => [doc.data().name, { id: doc.id, ...doc.data() } as Lens]));

          const newLenses: Partial<Lens>[] = [];
          const duplicatesToUpdate: LensForUpdate[] = [];

          for (const fileLens of fileLenses) {
            const existingLens = existingLensesMap.get(fileLens.name!);
            if (existingLens) {
                const updateData: Partial<Lens> = {};
                let needsUpdate = false;
                
                for (const key in fileLens) {
                    const lensKey = key as keyof Lens;
                    if (!Object.prototype.hasOwnProperty.call(fileLens, lensKey)) continue;

                    const newValue = fileLens[lensKey];
                    const existingValue = existingLens[lensKey];

                    if (newValue === null || newValue === undefined) continue;
                    
                    if (newValue !== existingValue) {
                       if (NUMERIC_PROPERTIES.includes(lensKey)) {
                           if (newValue !== 0 && newValue !== existingValue) {
                               (updateData as any)[lensKey] = newValue;
                               needsUpdate = true;
                           }
                       } else { // For non-numeric (string) properties
                           const isExistingValueMissing = existingValue === undefined || existingValue === null || existingValue === '';
                           if (isExistingValueMissing && newValue) {
                               (updateData as any)[lensKey] = newValue;
                               needsUpdate = true;
                           }
                       }
                    }
                }

                if (needsUpdate) {
                    duplicatesToUpdate.push({
                        id: existingLens.id,
                        name: existingLens.name,
                        newData: updateData,
                    });
                }
            } else {
              const completeLens: Partial<Lens> = {...fileLens};
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
              newLenses.push(completeLens);
            }
          }

          let description = `${newLenses.length} new lens(es) imported.`;
          if (duplicatesToUpdate.length > 0) {
            setLensesToUpdate(duplicatesToUpdate);
            setUpdateConfirmOpen(true);
          } else if (newLenses.length === 0) {
             const skippedCount = fileLenses.length - newLenses.length - duplicatesToUpdate.length;
             description = `No new lenses to import. ${skippedCount > 0 ? skippedCount + ' duplicate(s) without new info found.' : ''}`;
          }

          // Handle new lenses
          if (newLenses.length > 0) {
            const batch = writeBatch(firestore);
            newLenses.forEach(newLens => {
              const newDocRef = doc(productsCollection);
              batch.set(newDocRef, newLens);
            });
            await batch.commit().catch((error) => {
              const permissionError = new FirestorePermissionError({
                  path: productsCollection.path,
                  operation: 'write',
                  requestResourceData: newLenses
              });
              errorEmitter.emit('permission-error', permissionError);
            });
          }

          toast({
            title: 'Import Processed',
            description: description.trim(),
          });
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

      <UpdateConfirmationDialog
        open={isUpdateConfirmOpen}
        onOpenChange={setUpdateConfirmOpen}
        lensesToUpdate={lensesToUpdate}
        onConfirm={handleConfirmUpdate}
        onCancel={() => {
          setUpdateConfirmOpen(false);
          setLensesToUpdate([]);
          toast({
            title: 'Update Canceled',
            description: `${lensesToUpdate.length} lens(es) were not updated.`
          })
        }}
      />
    </div>
  );
}
