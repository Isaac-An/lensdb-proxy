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
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { collection, writeBatch, doc, getDocs, DocumentData } from 'firebase/firestore';

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

function mapDocToLens(doc: DocumentData): Lens {
    const data = doc.data();
    const lens: Partial<Lens> = { id: doc.id };
  
    const propertyMapping: { [key: string]: keyof Lens } = {
      'fovDiagonal': 'fovD',
      'fovHorizontal': 'fovH',
      'fovVertical': 'fovV',
    };

    for (const key in data) {
      const mappedKey = propertyMapping[key] || key;
      if (LENS_PROPERTIES.includes(mappedKey as any)) {
        let value = data[key];
        if (NUMERIC_PROPERTIES.includes(mappedKey as any)) {
          value = typeof value === 'string' ? parseFloat(value) : value;
          if (isNaN(value) || value === null || value === undefined) {
            value = 0;
          }
        }
        (lens as any)[mappedKey] = value;
      }
    }
  
    for (const prop of LENS_PROPERTIES) {
        if ((lens as any)[prop] === undefined) {
            if (NUMERIC_PROPERTIES.includes(prop)) {
                (lens as any)[prop] = 0;
            } else {
                (lens as any)[prop] = '';
            }
        }
    }
  
    return lens as Lens;
  }

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
    if (file && firestore && productsCollection) {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet);

          const keyMap: { [key: string]: keyof Lens } = {
            'product name': 'name',
            'name': 'name',
            'sensor size': 'sensorSize',
            'efl (mm)': 'efl',
            'efl': 'efl',
            'max image circle (mm)': 'maxImageCircle',
            'max image circle': 'maxImageCircle',
            'f. no.': 'fNo',
            'fno': 'fNo',
            'fov - diagonal (°)': 'fovD',
            'fov (d)': 'fovD',
            'fovd': 'fovD',
            'fov-d': 'fovD',
            'fov - horizontal (°)': 'fovH',
            'fov (h)': 'fovH',
            'fovh': 'fovH',
            'fov-h': 'fovH',
            'fov - vertical (°)': 'fovV',
            'fov (v)': 'fovV',
            'fovv': 'fovV',
            'fov-v': 'fovV',
            'ttl (mm)': 'ttl',
            'ttl': 'ttl',
            'tv distortion (%)': 'tvDistortion',
            'tv distortion': 'tvDistortion',
            'relative illumination (%)': 'relativeIllumination',
            'relative illumination': 'relativeIllumination',
            'chief ray angle (°)': 'chiefRayAngle',
            'chief ray angle': 'chiefRayAngle',
            'mount type': 'mountType',
            'mount': 'mountType',
            'lens structure': 'lensStructure',
          };
          
          const importedLenses = json.map((row: any) => {
            const lensData: Partial<Lens> = {};
            for (const excelKey in row) {
              const lowerKey = excelKey.toLowerCase().trim();
              const firestoreKey = keyMap[lowerKey];
              
              if (firestoreKey) {
                let value = row[excelKey];
                if (NUMERIC_PROPERTIES.includes(firestoreKey)) {
                  value = parseFloat(value);
                  if (isNaN(value)) value = 0;
                }
                (lensData as any)[firestoreKey] = value;
              }
            }

            LENS_PROPERTIES.forEach(prop => {
                if ((lensData as any)[prop] === undefined) {
                    if (NUMERIC_PROPERTIES.includes(prop)) {
                        (lensData as any)[prop] = 0;
                    } else if (prop !== 'name') {
                        (lensData as any)[prop] = '';
                    }
                }
            });

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
          
          const batch = writeBatch(firestore);

          const existingDocs = await getDocs(productsCollection);
          existingDocs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          importedLenses.forEach(newLens => {
            const newDocRef = doc(productsCollection);
            batch.set(newDocRef, newLens);
          });
          
          batch.commit()
            .then(() => {
                toast({ title: 'Import Complete', description: `${importedLenses.length} lenses imported successfully.` });
            })
            .catch((error) => {
              // Simplified error handling
              const permissionError = new FirestorePermissionError({
                  path: productsCollection.path,
                  operation: 'write'
              });
              errorEmitter.emit('permission-error', permissionError);
              toast({
                  variant: 'destructive',
                  title: 'Import Failed',
                  description: 'Could not save to database. Check permissions.',
              });
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
            sensorSizes={SENSOR_SIZES}
            mountTypes={MOUNT_TYPES}
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

    