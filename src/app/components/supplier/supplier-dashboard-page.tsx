
'use client';

import React, { useState, useMemo } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierFilterSidebar } from './supplier-filter-sidebar';
import { SupplierHeader } from './supplier-header';
import { SupplierProductList } from './supplier-product-list';
import { SupplierProductDetails } from './supplier-product-details';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { SupplierExcelImport } from './supplier-excel-import';
import { SupplierUpdateConfirmationDialog } from './supplier-update-confirmation-dialog';

export type SupplierFilters = {
  searchQuery: string;
  sensorSize: string;
  sensorName: string;
  mountType: string;
  supplier: string;
  efl: [number | null, number | null];
  fNo: [number | null, number | null];
  fovD: [number | null, number | null];
  fovH: [number | null, number | null];
  ttl: [number | null, number | null];
  sortOrder: 'asc' | 'desc' | 'none';
};

const initialFilters: SupplierFilters = {
  searchQuery: '',
  sensorSize: 'all',
  sensorName: 'all',
  mountType: 'all',
  supplier: 'all',
  efl: [null, null],
  fNo: [null, null],
  fovD: [null, null],
  fovH: [null, null],
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

const areSupplierLensesEqual = (lens1: Partial<SupplierLens>, lens2: Partial<SupplierLens>) => {
    const keysToCompare: (keyof SupplierLens)[] = [
        'supplier', 'sensorSize', 'efl', 'maxImageCircle', 'fNo', 'fovD', 'fovH', 'fovV',
        'ttl', 'tvDistortion', 'relativeIllumination', 'chiefRayAngle', 'mountType',
        'lensStructure', 'pdfUrl', 'price'
    ];

    for (const key of keysToCompare) {
        const val1 = String(lens1[key] ?? '').trim();
        const val2 = String(lens2[key] ?? '').trim();
        
        if (val1 !== val2) {
            return false;
        }
    }
    return true;
};

export function SupplierDashboardPage() {
  const { firestore } = useFirebase();
  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'supplier_lenses') : null, [firestore]);
  const { data: lenses = [], isLoading: isLoadingLenses } = useCollection<SupplierLens>(productsCollection);
  
  const [filters, setFilters] = useState<SupplierFilters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<SupplierLens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [lensesToUpdate, setLensesToUpdate] = useState<{current: SupplierLens, updated: SupplierLens}[]>([]);
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { toast } = useToast();

  const handleAppend = (lensesToAppend: SupplierLens[]) => {
    if (!firestore || !productsCollection) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
      return;
    }
    
    setIsImporting(true);
  
    // Using name and supplier as a composite key for uniqueness
    const existingLensesMap = new Map(lenses.map(l => [`${l.name}-${l.supplier}`, l]));
    const newLenses: SupplierLens[] = [];
    const changedLenses: {current: SupplierLens, updated: SupplierLens}[] = [];
    let skippedCount = 0;
  
    lensesToAppend.forEach(importedLens => {
      const existingLens = existingLensesMap.get(`${importedLens.name}-${importedLens.supplier}`);
      if (!existingLens) {
        newLenses.push(importedLens);
      } else {
        if (!areSupplierLensesEqual(existingLens, importedLens)) {
          changedLenses.push({ current: existingLens, updated: { ...importedLens, id: existingLens.id } });
        } else {
          skippedCount++;
        }
      }
    });
  
    if (newLenses.length > 0) {
      const batch = writeBatch(firestore);
      newLenses.forEach(lens => {
        const docRef = doc(productsCollection);
        batch.set(docRef, { ...lens, id: docRef.id });
      });
      batch.commit().then(() => {
        toast({
          title: 'Append Successful',
          description: `${newLenses.length} new supplier lens(es) were added.`,
        });
      }).catch(error => {
        toast({ variant: 'destructive', title: 'Append Failed', description: error.message });
      }).finally(() => setIsImporting(false));
    } else {
        setIsImporting(false);
    }

    if (changedLenses.length > 0) {
      setLensesToUpdate(changedLenses);
      setUpdateConfirmOpen(true);
    } else if (newLenses.length === 0) {
        toast({
            title: 'Append Complete',
            description: `No new lenses found. ${skippedCount > 0 ? `${skippedCount} identical lens(es) were skipped.` : ''}`,
        });
    }
  };

  const handleReplace = async (lensesToImport: SupplierLens[]) => {
    if (!firestore || !productsCollection) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
        return;
    }

    setIsImporting(true);
    toast({ title: 'Replacing Supplier Database', description: 'Please wait, this may take a moment...' });

    try {
        // 1. Delete all existing documents
        const existingDocs = await getDocs(productsCollection);
        const deleteBatch = writeBatch(firestore);
        existingDocs.forEach(doc => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
        toast({ title: 'Old Data Deleted', description: 'Now importing new supplier data...' });


        // 2. Add new documents
        const addBatch = writeBatch(firestore);
        lensesToImport.forEach(lens => {
            const docRef = doc(productsCollection);
            addBatch.set(docRef, { ...lens, id: docRef.id });
        });
        await addBatch.commit();

        toast({
            title: 'Replace Successful',
            description: `Successfully imported ${lensesToImport.length} new supplier lens(es).`,
        });

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Replace Failed',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsImporting(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!firestore || lensesToUpdate.length === 0) return;

    const batch = writeBatch(firestore);
    lensesToUpdate.forEach(({ updated }) => {
      const docRef = doc(firestore, 'supplier_lenses', updated.id);
      batch.set(docRef, updated);
    });

    try {
      await batch.commit();
      toast({
        title: 'Update Successful',
        description: `${lensesToUpdate.length} supplier lens(es) were updated.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update supplier lenses in the database.',
      });
    } finally {
      setLensesToUpdate([]);
      setUpdateConfirmOpen(false);
    }
  };
  
  const { sensorSizes, mountTypes, sensorNames, suppliers } = useMemo(() => {
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
    
    const allLenses = lenses || [];

    const baseSensorSizes = allLenses.map(l => {
      const size = l.sensorSize || '';
      const spaceIndex = size.indexOf(' ');
      return spaceIndex !== -1 ? size.substring(0, spaceIndex) : size;
    }).filter(Boolean);

    const sensorNames = [...new Set(allLenses.map(l => {
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
    const mountTypes = [...new Set(allLenses.map(l => l.mountType).filter(Boolean) as string[])].sort();
    const suppliers = [...new Set(allLenses.map(l => l.supplier).filter(Boolean) as string[])].sort();
    return { sensorSizes: sortedSensorSizes, mountTypes, sensorNames, suppliers };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, fovH, ttl, sortOrder, sensorName, supplier } = filters;
  
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
      
      if (sensorSize !== 'all' && !(lens.sensorSize || '').startsWith(sensorSize)) {
        return false;
      }

      if (sensorName !== 'all' && !(lens.sensorSize || '').includes(sensorName)) {
        return false;
      }

      if (mountType !== 'all' && lens.mountType !== mountType) {
        return false;
      }
      
      if (supplier !== 'all' && lens.supplier !== supplier) {
        return false;
      }

      const eflVal = parseFloat(String(lens.efl));
      if (efl[0] !== null && (isNaN(eflVal) || eflVal < efl[0])) return false;
      if (efl[1] !== null && (isNaN(eflVal) || eflVal > efl[1])) return false;
  
      const fNoVal = parseFloat(String(lens.fNo));
      if (fNo[0] !== null && (isNaN(fNoVal) || fNoVal < fNo[0])) return false;
      if (fNo[1] !== null && (isNaN(fNoVal) || fNoVal > fNo[1])) return false;
  
      const fovDVal = parseFloat(String(lens.fovD));
      if (fovD[0] !== null && (isNaN(fovDVal) || fovDVal < fovD[0])) return false;
      if (fovD[1] !== null && (isNaN(fovDVal) || fovDVal > fovD[1])) return false;
  
      const fovHVal = parseFloat(String(lens.fovH));
      if (fovH[0] !== null && (isNaN(fovHVal) || fovHVal < fovH[0])) return false;
      if (fovH[1] !== null && (isNaN(fovHVal) || fovHVal > fovH[1])) return false;

      const ttlVal = parseFloat(String(lens.ttl));
      if (ttl[0] !== null && (isNaN(ttlVal) || ttlVal < ttl[0])) return false;
      if (ttl[1] !== null && (isNaN(ttlVal) || ttlVal > ttl[1])) return false;

      return true;
    });

  }, [filters, lenses]);

  const handleSelectLens = (lens: SupplierLens) => {
    setSelectedLens(lens);
    setDetailsOpen(true);
  };

  const isLoading = isLoadingLenses || isImporting;

  return (
    <div className="flex h-screen bg-background">
      <div className="w-1/3 border-r">
          <SupplierFilterSidebar 
            filters={filters} 
            setFilters={setFilters} 
            resetFilters={() => setFilters(initialFilters)}
            sensorSizes={sensorSizes}
            mountTypes={mountTypes}
            sensorNames={sensorNames}
            suppliers={suppliers}
          />
      </div>
      <div className="w-2/3 flex flex-col">
        <SupplierHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
        >
          <SupplierExcelImport onAppend={handleAppend} onReplace={handleReplace} isDisabled={isLoading} />
        </SupplierHeader>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <SupplierProductList lenses={filteredLenses} isLoading={isLoading} onSelectLens={handleSelectLens} />
        </main>
      </div>

      {selectedLens && (
        <SupplierProductDetails 
          lens={selectedLens} 
          open={isDetailsOpen} 
          onOpenChange={setDetailsOpen} 
        />
      )}

      <SupplierUpdateConfirmationDialog
        isOpen={isUpdateConfirmOpen}
        onClose={() => setUpdateConfirmOpen(false)}
        onConfirm={handleConfirmUpdate}
        lensesToUpdate={lensesToUpdate}
      />
    </div>
  );
}
