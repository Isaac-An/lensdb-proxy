'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Lens } from '@/app/lib/types';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { SplitReviewDialog } from './split-review-dialog';
import { useToast } from '@/hooks/use-toast';
import { DataMenu } from './data-menu';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { UpdateConfirmationDialog } from './update-confirmation-dialog';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { LensComparison } from './lens-comparison';
import { CompareBar } from './compare-bar';

export type Filters = {
  searchQuery: string;
  sensorSize: string;
  sensorName: string;
  mountType: string;
  efl: [number | null, number | null];
  fNo: [number | null, number | null];
  fovD: [number | null, number | null];
  fovH: [number | null, number | null];
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
        if (aNum !== bNum) return aNum - bNum;
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
        const val1 = String(lens1[key] ?? '').trim();
        const val2 = String(lens2[key] ?? '').trim();
        if (val1 !== val2) return false;
    }
    return true;
};

// Extract mount type prefix: "M12XP0.5" -> "M12", "M12x0.5" -> "M12", "C-Mount" -> "C-Mount"
// Handles x, X, *, and the Unicode multiplication sign U+00D7
function getMountPrefix(mountType: string | null | undefined): string | null {
  if (!mountType) return null;
  // Split on any separator: *, x, X, ×, or spaces around them
  const match = mountType.match(/^([A-Za-z]+[\d]*(?:\.\d+)?)\s*[\*xX\u00D7]\s*/i);
  if (match) {
    // Remove trailing .00 or .0 (M12.00 -> M12, M8.00 -> M8)
    return match[1].replace(/\.0+$/, '').trim();
  }
  return mountType.trim();
}

export function DashboardPage() {
  const { firestore, isUserLoading, userError } = useFirebase();
  const { isAdmin } = useIsAdmin();
  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: lenses = [], isLoading: isLoadingLenses } = useCollection<Lens>(productsCollection);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [splitLens, setSplitLens] = useState<Lens | null>(null);
  const [isSplitOpen, setSplitOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [lensesToUpdate, setLensesToUpdate] = useState<{current: Lens, updated: Lens}[]>([]);
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Lens[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);

  const { toast } = useToast();

  const handleAppend = (lensesToAppend: Lens[]) => {
    if (!firestore || !productsCollection) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
      return;
    }
    setIsImporting(true);
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
        const docRef = doc(productsCollection);
        batch.set(docRef, { ...lens, id: docRef.id });
      });
      batch.commit().then(() => {
        toast({ title: 'Append Successful', description: `${newLenses.length} new lens(es) were added.` });
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
      toast({ title: 'Append Complete', description: `No new lenses found. ${skippedCount > 0 ? `${skippedCount} identical lens(es) were skipped.` : ''}` });
    }
  };

  const handleReplace = async (lensesToImport: Lens[]) => {
    if (!firestore || !productsCollection) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
      return;
    }
    setIsImporting(true);
    toast({ title: 'Replacing Database', description: 'Please wait, this may take a moment...' });
    try {
      const existingDocs = await getDocs(productsCollection);
      const deleteBatch = writeBatch(firestore);
      existingDocs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      toast({ title: 'Old Data Deleted', description: 'Now importing new data...' });
      const addBatch = writeBatch(firestore);
      lensesToImport.forEach(lens => {
        const docRef = doc(productsCollection);
        addBatch.set(docRef, { ...lens, id: docRef.id });
      });
      await addBatch.commit();
      toast({ title: 'Replace Successful', description: `Successfully imported ${lensesToImport.length} new lens(es).` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Replace Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsImporting(false);
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
      toast({ title: 'Update Successful', description: `${lensesToUpdate.length} lens(es) were updated.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not update lenses in the database.' });
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
        if (valA !== valB) return valB - valA;
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
        if (parts[1] && parts[1].toUpperCase() === 'ST' && parts.length > 2) return `${parts[1]} ${parts[2]}`;
        return parts[1];
      }
      return null;
    }).filter(Boolean) as string[])].sort();

    const uniqueSensorSizes = [...new Set(baseSensorSizes)];
    const sortedSensorSizes = uniqueSensorSizes.sort(customSensorSort);

    const mountTypes = [...new Set(
      (lenses || []).map(l => getMountPrefix(l.mountType)).filter((s): s is string => s !== null)
    )].sort((a, b) => {
      const aNum = parseFloat(a.replace(/^M/i, ''));
      const bNum = parseFloat(b.replace(/^M/i, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });

    return { sensorSizes: sortedSensorSizes, mountTypes, sensorNames };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, fovH, ttl, sortOrder, sensorName } = filters;
    let processedLenses = [...(lenses || [])];
    if (sortOrder !== 'none') {
      processedLenses.sort((a, b) => sortOrder === 'asc' ? naturalSort(a.name, b.name) : naturalSort(b.name, a.name));
    }
    return processedLenses.filter(lens => {
      if (searchQuery && !lens.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (sensorSize !== 'all' && !lens.sensorSize?.startsWith(sensorSize)) return false;
      if (sensorName !== 'all' && !lens.sensorSize?.includes(sensorName)) return false;
      if (mountType !== 'all') {
        const prefix = getMountPrefix(lens.mountType);
        if (prefix !== mountType) return false;
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

  const handleToggleCompare = (lens: Lens) => {
    setSelectedForCompare(prev => {
      if (prev.some(l => l.id === lens.id)) return prev.filter(l => l.id !== lens.id);
      if (prev.length >= 3) return prev;
      return [...prev, lens];
    });
  };

  const handleSelectLens = (lens: Lens) => {
    if (lens.extractionStatus === 'needs_split_review') {
      setSplitLens(lens);
      setSplitOpen(true);
      return;
    }
    setSelectedLens(lens);
    setDetailsOpen(true);
  };

  const isLoading = isLoadingLenses || isImporting || isUserLoading;
  const isButtonDisabled = isLoading || (!!userError && process.env.NODE_ENV === 'production');

  if (userError && process.env.NODE_ENV === 'production') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-destructive">Authentication Error</h2>
          <p className="mt-2 text-muted-foreground">Could not sign in to Firebase to access data.</p>
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-left text-sm text-destructive">
            <p className="font-mono">{userError.message}</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This is often caused by the app's domain not being authorized in your Firebase project's Authentication settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="w-[350px] shrink-0 border-r">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          resetFilters={() => setFilters(initialFilters)}
          sensorSizes={sensorSizes}
          mountTypes={mountTypes}
          sensorNames={sensorNames}
          lensCount={filteredLenses.length}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
        >
          <DataMenu onAppend={handleAppend} onReplace={handleReplace} isDisabled={isButtonDisabled} allLenses={lenses} />
        </AppHeader>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <CompareBar
            selected={selectedForCompare}
            onRemove={(id) => setSelectedForCompare(prev => prev.filter(l => l.id !== id))}
            onCompare={() => setCompareOpen(true)}
            onClear={() => setSelectedForCompare([])}
          />
          <ProductList lenses={filteredLenses} isLoading={isLoading} onSelectLens={handleSelectLens} selectedForCompare={selectedForCompare} onToggleCompare={handleToggleCompare} />
        </main>
      </div>
      {selectedLens && (
        <ProductDetails
          lens={selectedLens}
          open={isDetailsOpen}
          onOpenChange={setDetailsOpen}
          isAdmin={isAdmin}
        />
      )}
      {splitLens && (
        <SplitReviewDialog
          stagingLens={splitLens}
          open={isSplitOpen}
          onOpenChange={(o) => { setSplitOpen(o); if (!o) setSplitLens(null); }}
        />
      )}
      <UpdateConfirmationDialog
        isOpen={isUpdateConfirmOpen}
        onClose={() => setUpdateConfirmOpen(false)}
        onConfirm={handleConfirmUpdate}
        lensesToUpdate={lensesToUpdate}
      />
      {selectedForCompare.length >= 2 && (
        <LensComparison
          lenses={selectedForCompare}
          open={isCompareOpen}
          onOpenChange={setCompareOpen}
        />
      )}
    </div>
  );
}