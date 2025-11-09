
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Lens } from '@/app/lib/types';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { useToast } from '@/hooks/use-toast';
import { ExcelImport } from './excel-import';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { UpdateConfirmationDialog } from './update-confirmation-dialog';

export type Filters = {
  searchQuery: string;
  sensorSize: string;
  sensorName: string;
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
  sensorName: 'all',
  mountType: 'all',
  efl: [null, null],
  fNo: [null, null],
  fovD: [null, null],
  ttl: [null, null],
  sortOrder: 'none',
};

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

const areLensesEqual = (lens1: Partial<Lens>, lens2: Partial<Lens>) => {
    const keysToCompare: (keyof Lens)[] = [
        'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV',
        'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'mountType',
        'lensStructure', 'pdfUrl', 'price'
    ];

    for (const key of keysToCompare) {
        const val1 = lens1[key] ?? null;
        const val2 = lens2[key] ?? null;

        if (typeof val1 === 'number' && typeof val2 === 'number') {
            // Round both numbers to 3 decimal places for comparison
            if (parseFloat(val1.toFixed(3)) !== parseFloat(val2.toFixed(3))) return false;
        } else if (val1 !== val2) {
            // Handle cases where one is a number and the other is null, or both are non-numeric
            if ((val1 === null && val2 !== null) || (val1 !== null && val2 === null)) {
                 // Consider 0 and null as different
                if (val1 === 0 && val2 === null || val1 === null && val2 === 0) {
                   // This can be customized. For now, let's treat them as potentially different.
                } else if (val1 !== val2) return false;
            } else if (val1 !== val2) return false;
        }
    }
    return true;
};

export function DashboardPage() {
  const { firestore } = useFirebase();
  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: lenses = [], isLoading } = useCollection<Lens>(productsCollection);
  
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [lensesToUpdate, setLensesToUpdate] = useState<{current: Lens, updated: Lens}[]>([]);
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  
  const { toast } = useToast();

  const handleAppend = (lensesToAppend: Lens[]) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
      return;
    }
  
    const existingLensesMap = new Map(lenses.map(l => [l.name, l]));
    const newLenses: Lens[] = [];
    const changedLenses: {current: Lens, updated: Lens}[] = [];
    let skippedCount = 0;
  
    lensesToAppend.forEach(importedLens => {
      const existingLens = existingLensesMap.get(importedLens.name);
      if (!existingLens) {
        newLenses.push(importedLens);
      } else {
        if (!areLensesEqual(existingLens, importedLens)) {
          changedLenses.push({ current: existingLens, updated: { ...importedLens, id: existingLens.id } });
        } else {
          skippedCount++;
        }
      }
    });
  
    if (newLenses.length > 0) {
      const batch = writeBatch(firestore);
      newLenses.forEach(lens => {
        const docRef = doc(productsCollection!);
        batch.set(docRef, { ...lens, id: docRef.id });
      });
      batch.commit().then(() => {
        toast({
          title: 'Import Successful',
          description: `${newLenses.length} new lens(es) were added.`,
        });
      }).catch(error => {
        toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
      });
    }

    if (changedLenses.length > 0) {
      setLensesToUpdate(changedLenses);
      setUpdateConfirmOpen(true);
    } else if (newLenses.length === 0) {
        toast({
            title: 'Import Complete',
            description: `No new or changed lenses found. ${skippedCount > 0 ? `${skippedCount} identical lens(es) were skipped.` : ''}`,
        });
    }
  };

  const handleConfirmUpdate = async () => {
    if (!firestore || lensesToUpdate.length === 0) return;

    const batch = writeBatch(firestore);
    lensesToUpdate.forEach(({ updated }) => {
      const docRef = doc(firestore, 'products', updated.id);
      batch.set(docRef, updated);
    });

    try {
      await batch.commit();
      toast({
        title: 'Update Successful',
        description: `${lensesToUpdate.length} lens(es) were updated.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update lenses in the database.',
      });
    } finally {
      setLensesToUpdate([]);
      setUpdateConfirmOpen(false);
    }
  };


  const { sensorSizes, mountTypes, sensorNames } = useMemo(() => {
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
    
    const baseSensorSizes = (lenses || []).map(l => {
      const size = l.sensorSize || '';
      const spaceIndex = size.indexOf(' ');
      return spaceIndex !== -1 ? size.substring(0, spaceIndex) : size;
    }).filter(Boolean);

    const sensorNames = [...new Set((lenses || []).map(l => {
        const size = l.sensorSize || '';
        const parts = size.split(' ');
        if (parts.length > 1 && parts[0].includes('"')) {
            if (parts[1] && parts[1].toUpperCase() === 'ST' && parts.length > 2) {
                return `${parts[1]} ${parts[2]}`;
            }
            return parts[1];
        }
        return null;
    }).filter(Boolean) as string[])].sort();

    const uniqueSensorSizes = [...new Set(baseSensorSizes)];
    const sortedSensorSizes = uniqueSensorSizes.sort(customSensorSort);
    const mountTypes = [...new Set((lenses || []).map(l => l.mountType).filter(Boolean))].sort();
    return { sensorSizes: sortedSensorSizes, mountTypes, sensorNames };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, ttl, sortOrder, sensorName } = filters;
  
    let processedLenses = [...(lenses || [])];
  
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
      if (searchQuery && !lens.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (sensorSize !== 'all' && !lens.sensorSize.startsWith(sensorSize)) {
        return false;
      }

      if (sensorName !== 'all' && !lens.sensorSize.includes(sensorName)) {
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

  return (
    <div className="flex h-screen bg-background">
      <div className="w-1/3 border-r">
          <FilterSidebar 
            filters={filters} 
            setFilters={setFilters} 
            resetFilters={() => setFilters(initialFilters)}
            sensorSizes={sensorSizes}
            mountTypes={mountTypes}
            sensorNames={sensorNames}
          />
      </div>
      <div className="w-2/3 flex flex-col">
        <AppHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
        >
          <ExcelImport onAppend={handleAppend} />
        </AppHeader>
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

      <UpdateConfirmationDialog
        isOpen={isUpdateConfirmOpen}
        onClose={() => setUpdateConfirmOpen(false)}
        onConfirm={handleConfirmUpdate}
        lensesToUpdate={lensesToUpdate}
      />
    </div>
  );
}
