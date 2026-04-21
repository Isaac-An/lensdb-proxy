'use client';

import React, { useState, useMemo } from 'react';
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
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { UpdateConfirmationDialog } from './update-confirmation-dialog';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { LensComparison } from './lens-comparison';
import { CompareBar } from './compare-bar';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import dynamic from 'next/dynamic';

const ErrorDashboard = dynamic(() => import('./error-dashboard').then(m => m.ErrorDashboard), { ssr: false });
const ErrorDashboardBadge = dynamic(() => import('./error-dashboard').then(m => m.ErrorDashboardBadge), { ssr: false });

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
    'lensStructure', 'pdfUrl', 'price',
  ];
  for (const key of keysToCompare) {
    if (String(lens1[key] ?? '').trim() !== String(lens2[key] ?? '').trim()) return false;
  }
  return true;
};

function getMountPrefix(mountType: string | null | undefined): string | null {
  if (!mountType) return null;
  const match = mountType.match(/^([A-Za-z]+[\d]*(?:\.\d+)?)\s*[\*xX\u00D7]\s*/i);
  if (match) return match[1].replace(/\.0+$/, '').trim();
  return mountType.trim();
}

export function DashboardPage() {
  const { firestore, isUserLoading, userError } = useFirebase();
  const { isAdmin, isSuperAdmin } = useIsAdmin();
  const { addRecent } = useRecentlyViewed();
  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: rawLenses, isLoading: isLoadingLenses } = useCollection<Lens>(productsCollection);
  const lenses: Lens[] = (rawLenses ?? []) as Lens[];

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [splitLens, setSplitLens] = useState<Lens | null>(null);
  const [isSplitOpen, setSplitOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [lensesToUpdate, setLensesToUpdate] = useState<{ current: Lens; updated: Lens }[]>([]);
  const [isUpdateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Lens[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);
  const [showErrorDashboard, setShowErrorDashboard] = useState(false);

  const { toast } = useToast();

  const handleAppend = (lensesToAppend: Lens[]) => {
    if (!firestore || !productsCollection) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not available.' });
      return;
    }
    setIsImporting(true);
    const existingLensesMap = new Map(lenses.map(l => [l.name, l]));
    const newLenses: Lens[] = [];
    const changedLenses: { current: Lens; updated: Lens }[] = [];
    let skippedCount = 0;
    lensesToAppend.forEach(importedLens => {
      const existingLens = existingLensesMap.get(importedLens.name);
      if (!existingLens) {
        newLenses.push(importedLens);
      } else if (!areLensesEqual(existingLens, importedLens)) {
        changedLenses.push({ current: existingLens, updated: { ...importedLens, id: existingLens.id } });
      } else {
        skippedCount++;
      }
    });
    if (newLenses.length > 0) {
      const batch = writeBatch(firestore);
      newLenses.forEach(lens => {
        const docRef = doc(productsCollection);
        batch.set(docRef, { ...lens, id: docRef.id });
      });
      batch.commit()
        .then(() => toast({ title: 'Append Successful', description: `${newLenses.length} new lens(es) were added.` }))
        .catch(error => toast({ variant: 'destructive', title: 'Append Failed', description: error.message }))
        .finally(() => setIsImporting(false));
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
    toast({ title: 'Replacing Database', description: 'Please wait...' });
    try {
      const existingDocs = await getDocs(productsCollection);
      const deleteBatch = writeBatch(firestore);
      existingDocs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
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
      batch.set(doc(firestore, 'products', updated.id), updated);
    });
    try {
      await batch.commit();
      toast({ title: 'Update Successful', description: `${lensesToUpdate.length} lens(es) were updated.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
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

    const baseSensorSizes = lenses.map(l => {
      const size = l.sensorSize || '';
      const idx = size.indexOf(' ');
      return idx !== -1 ? size.substring(0, idx) : size;
    }).filter(Boolean);

    const sensorNames = [...new Set(lenses.map(l => {
      const size = l.sensorSize || '';
      const parts = size.split(' ');
      if (parts.length > 1 && parts[0].includes('"')) {
        if (parts[1]?.toUpperCase() === 'ST' && parts.length > 2) return `${parts[1]} ${parts[2]}`;
        return parts[1];
      }
      return null;
    }).filter(Boolean) as string[])].sort();

    const sortedSensorSizes = [...new Set(baseSensorSizes)].sort(customSensorSort);

    const mountTypes = [...new Set(
      lenses.map(l => getMountPrefix(l.mountType)).filter((s): s is string => s !== null)
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
    let result = [...lenses];
    if (sortOrder !== 'none') {
      result.sort((a, b) => sortOrder === 'asc' ? naturalSort(a.name, b.name) : naturalSort(b.name, a.name));
    }
    return result.filter(lens => {
      if (searchQuery && !lens.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (sensorSize !== 'all' && !lens.sensorSize?.startsWith(sensorSize)) return false;
      if (sensorName !== 'all' && !lens.sensorSize?.includes(sensorName)) return false;
      if (mountType !== 'all' && getMountPrefix(lens.mountType) !== mountType) return false;
      const check = (val: number, range: [number | null, number | null]) =>
        (range[0] === null || val >= range[0]) && (range[1] === null || val <= range[1]);
      if (!check(parseFloat(String(lens.efl)), efl)) return false;
      if (!check(parseFloat(String(lens.fNo)), fNo)) return false;
      if (!check(parseFloat(String(lens.fovD)), fovD)) return false;
      if (!check(parseFloat(String(lens.fovH)), fovH)) return false;
      if (!check(parseFloat(String(lens.ttl)), ttl)) return false;
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
    addRecent({ id: lens.id, name: lens.name, sensorSize: lens.sensorSize, source: 'products' });
    if (lens.extractionStatus === 'needs_split_review') {
      setSplitLens(lens); setSplitOpen(true); return;
    }
    setSelectedLens(lens); setDetailsOpen(true);
  };

  const handleSelectRecentLens = (id: string) => {
    const lens = lenses.find(l => l.id === id);
    if (lens) handleSelectLens(lens);
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
          onSearchChange={(query) => setFilters(prev => ({ ...prev, searchQuery: query }))}
          onSelectRecentLens={handleSelectRecentLens}
        >
          {isSuperAdmin && <ErrorDashboardBadge onClick={() => setShowErrorDashboard(true)} />}
          <DataMenu onAppend={handleAppend} onReplace={handleReplace} isDisabled={isButtonDisabled} allLenses={lenses} />
        </AppHeader>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <CompareBar
            selected={selectedForCompare}
            onRemove={(id) => setSelectedForCompare(prev => prev.filter(l => l.id !== id))}
            onCompare={() => setCompareOpen(true)}
            onClear={() => setSelectedForCompare([])}
          />
          <ProductList
            lenses={filteredLenses}
            isLoading={isLoading}
            onSelectLens={handleSelectLens}
            selectedForCompare={selectedForCompare}
            onToggleCompare={handleToggleCompare}
          />
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
      <ErrorDashboard open={showErrorDashboard} onClose={() => setShowErrorDashboard(false)} />
    </div>
  );
}