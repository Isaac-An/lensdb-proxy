'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierFilterSidebar } from './supplier-filter-sidebar';
import { SupplierHeader } from './supplier-header';
import { SupplierProductList } from './supplier-product-list';
import { SupplierProductDetails } from './supplier-product-details';
import { SupplierExcelImport } from './supplier-excel-import';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs, getCountFromServer, writeBatch, doc } from 'firebase/firestore';
import { LensComparison } from '../lens-comparison';
import { CompareBar } from '../compare-bar';
import { useToast } from '@/hooks/use-toast';
import type { Lens } from '@/app/lib/types';

export type SupplierFilters = {
  searchQuery: string;
  sensorSize: string;
  origin: string;
  mountType: string;
  supplier: string;
  efl: [number | null, number | null];
  fNo: [number | null, number | null];
  fovD: [number | null, number | null];
  fovH: [number | null, number | null];
  ttl: [number | null, number | null];
  imageCircle: [number | null, number | null];
  sortOrder: 'asc' | 'desc' | 'none';
};

const initialFilters: SupplierFilters = {
  searchQuery: '',
  sensorSize: 'all',
  origin: 'all',
  mountType: 'all',
  supplier: 'all',
  efl: [null, null],
  fNo: [null, null],
  fovD: [null, null],
  fovH: [null, null],
  ttl: [null, null],
  imageCircle: [null, null],
  sortOrder: 'none',
};

const PAGE_SIZE = 40;
const FETCH_ALL_BATCH = 500;

function parseNum(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function sanitizeSensorSize(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return null;
  return str || null;
}

function mountPrefix(val: string | null | undefined): string | null {
  if (!val) return null;
  const str = val.trim();
  // Match M-series: extract just "M" + number prefix before any separator
  // Handles: M12*0.5, M12*P0.5, M12x0.5, M12xP0.5, M4.00XP0.20
  const mMount = str.match(/^(M[\d\.]+)/i);
  if (mMount) return mMount[1].replace(/\.0+$/, ''); // M4.00 → M4
  // Keep named mounts as-is: C-Mount, CS-Mount, Board Type
  return str;
}

export function SupplierDashboardPage() {
  const { firestore, isUserLoading, userError } = useFirebase();
  const { toast } = useToast();
  const [filters, setFilters] = useState<SupplierFilters>(initialFilters);
  const [lenses, setLenses] = useState<SupplierLens[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const lastDocRef = useRef<any>(null);
  const [allLenses, setAllLenses] = useState<SupplierLens[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fetchIdRef = useRef(0);
  const fetchAllIdRef = useRef(0);
  const [selectedLens, setSelectedLens] = useState<SupplierLens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<SupplierLens[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);

  const filterOptions = useMemo(() => {
    if (allLenses.length === 0) return { mountTypes: [], suppliers: [], origins: [], sensorSizes: [] };
    const mountTypes = [...new Set(
  allLenses.map(l => mountPrefix(l.mountType)).filter((s): s is string => s !== null)

)].sort((a, b) => {
  const aNum = parseFloat(a.replace(/^M/i, ''));
  const bNum = parseFloat(b.replace(/^M/i, ''));
  // Both M-series: sort numerically
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  // M-series before named mounts
  if (!isNaN(aNum)) return -1;
  if (!isNaN(bNum)) return 1;
  // Both named: alphabetical
  return a.localeCompare(b);
});

    const suppliers = [...new Set(allLenses.map(l => l.supplier).filter(Boolean))].sort() as string[];
    const origins = [...new Set(allLenses.map(l => l.countryOfOrigin).filter(Boolean))].sort() as string[];
    const sensorSizes = [...new Set(
      allLenses.map(l => sanitizeSensorSize(l.sensorSize)).filter((s): s is string => s !== null)
    )].sort();
    return { mountTypes, suppliers, origins, sensorSizes };
  }, [allLenses]);

  const fetchLenses = useCallback(async (reset: boolean) => {
    if (!firestore) return;
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      const col = collection(firestore, 'supplier_lenses');
      const q = query(
        col,
        orderBy('name'),
        limit(PAGE_SIZE),
        ...(reset || !lastDocRef.current ? [] : [startAfter(lastDocRef.current)])
      );
      const snap = await getDocs(q);
      if (fetchId !== fetchIdRef.current) return;
      const docs = snap.docs.map(d => ({ ...(d.data() as SupplierLens), id: d.id }));
      if (reset) {
        setLenses(docs);
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        try {
          const countSnap = await getCountFromServer(col);
          if (fetchId === fetchIdRef.current) setTotalCount(countSnap.data().count);
        } catch {
          setTotalCount(docs.length);
        }
      } else {
        setLenses(prev => [...prev, ...docs]);
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      }
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('fetchLenses error:', err);
    } finally {
      if (fetchId === fetchIdRef.current) setIsLoading(false);
    }
  }, [firestore]);

  const fetchAllForSearch = useCallback(async () => {
    if (!firestore) return;
    const fetchAllId = ++fetchAllIdRef.current;
    setIsFetchingAll(true);
    setAllLenses([]);
    try {
      const col = collection(firestore, 'supplier_lenses');
      let lastDoc: any = null;
      const accumulated: SupplierLens[] = [];
      while (true) {
        if (fetchAllId !== fetchAllIdRef.current) return;
        const q = query(
          col,
          orderBy('name'),
          limit(FETCH_ALL_BATCH),
          ...(lastDoc ? [startAfter(lastDoc)] : [])
        );
        const snap = await getDocs(q);
        const batch = snap.docs.map(d => ({ ...(d.data() as SupplierLens), id: d.id }));
        accumulated.push(...batch);
        lastDoc = snap.docs[snap.docs.length - 1] || null;
        if (snap.docs.length < FETCH_ALL_BATCH) break;
      }
      if (fetchAllId === fetchAllIdRef.current) setAllLenses(accumulated);
    } catch (err) {
      console.error('fetchAllForSearch error:', err);
    } finally {
      if (fetchAllId === fetchAllIdRef.current) setIsFetchingAll(false);
    }
  }, [firestore]);

  const handleAppend = async (lensesToAppend: SupplierLens[]) => {
    if (!firestore) return;
    setIsImporting(true);
    try {
      const col = collection(firestore, 'supplier_lenses');
      for (let i = 0; i < lensesToAppend.length; i += 500) {
        const batch = writeBatch(firestore);
        lensesToAppend.slice(i, i + 500).forEach(lens => {
          const ref = doc(col);
          batch.set(ref, { ...lens, id: ref.id });
        });
        await batch.commit();
      }
      toast({ title: 'Import Successful', description: `${lensesToAppend.length} lenses added.` });
      lastDocRef.current = null;
      fetchLenses(true);
      fetchAllForSearch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReplace = async (lensesToImport: SupplierLens[]) => {
    if (!firestore) return;
    setIsImporting(true);
    toast({ title: 'Replacing...', description: 'Deleting old data, please wait.' });
    try {
      const col = collection(firestore, 'supplier_lenses');
      // Delete all existing
      const existing = await getDocs(col);
      const deleteBatch = writeBatch(firestore);
      existing.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
      // Write new in batches
      for (let i = 0; i < lensesToImport.length; i += 500) {
        const batch = writeBatch(firestore);
        lensesToImport.slice(i, i + 500).forEach(lens => {
          const ref = doc(col);
          batch.set(ref, { ...lens, id: ref.id });
        });
        await batch.commit();
      }
      toast({ title: 'Replace Successful', description: `${lensesToImport.length} lenses imported.` });
      lastDocRef.current = null;
      fetchLenses(true);
      fetchAllForSearch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Replace Failed', description: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const needsAllLenses = useMemo(() => {
    const { searchQuery, efl, fNo, fovD, fovH, ttl, imageCircle, sensorSize, origin, mountType, supplier } = filters;
    return !!(
      searchQuery ||
      sensorSize !== 'all' ||
      origin !== 'all' ||
      mountType !== 'all' ||
      supplier !== 'all' ||
      efl[0] !== null || efl[1] !== null ||
      fNo[0] !== null || fNo[1] !== null ||
      fovD[0] !== null || fovD[1] !== null ||
      fovH[0] !== null || fovH[1] !== null ||
      ttl[0] !== null || ttl[1] !== null ||
      imageCircle[0] !== null || imageCircle[1] !== null
    );
  }, [filters]);

  useEffect(() => {
    if (!firestore) return;
    lastDocRef.current = null;
    fetchLenses(true);
  }, [firestore]);

  useEffect(() => {
    if (!firestore) return;
    fetchAllForSearch();
  }, [firestore]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) fetchLenses(false);
  }, [isLoading, hasMore, fetchLenses]);

  const filteredLenses = useMemo(() => {
    const source = needsAllLenses ? allLenses : lenses;
    let result = [...source];
    const { searchQuery, efl, fNo, fovD, fovH, ttl, imageCircle, sensorSize, origin, mountType, supplier } = filters;

    if (searchQuery) result = result.filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (supplier !== 'all') result = result.filter(l => l.supplier === supplier);
    if (origin === 'non-china') {
      result = result.filter(l => l.countryOfOrigin?.toLowerCase() !== 'china');
    } else if (origin !== 'all') {
      result = result.filter(l => l.countryOfOrigin === origin);
    }
    if (mountType !== 'all') {
      result = result.filter(l => mountPrefix(l.mountType) === mountType);
    }
    if (sensorSize !== 'all') {
      result = result.filter(l => sanitizeSensorSize(l.sensorSize) === sensorSize);
    }
    if (efl[0] !== null) result = result.filter(l => { const v = parseNum(l.efl); return v !== null && v >= efl[0]!; });
    if (efl[1] !== null) result = result.filter(l => { const v = parseNum(l.efl); return v !== null && v <= efl[1]!; });
    if (fNo[0] !== null) result = result.filter(l => { const v = parseNum(l.fNo); return v !== null && v >= fNo[0]!; });
    if (fNo[1] !== null) result = result.filter(l => { const v = parseNum(l.fNo); return v !== null && v <= fNo[1]!; });
    if (fovD[0] !== null) result = result.filter(l => { const v = parseNum(l.fovD); return v !== null && v >= fovD[0]!; });
    if (fovD[1] !== null) result = result.filter(l => { const v = parseNum(l.fovD); return v !== null && v <= fovD[1]!; });
    if (fovH[0] !== null) result = result.filter(l => { const v = parseNum(l.fovH); return v !== null && v >= fovH[0]!; });
    if (fovH[1] !== null) result = result.filter(l => { const v = parseNum(l.fovH); return v !== null && v <= fovH[1]!; });
    if (ttl[0] !== null) result = result.filter(l => { const v = parseNum(l.ttl); return v !== null && v >= ttl[0]!; });
    if (ttl[1] !== null) result = result.filter(l => { const v = parseNum(l.ttl); return v !== null && v <= ttl[1]!; });
    if (imageCircle[0] !== null) result = result.filter(l => { const v = parseNum(l.maxImageCircle); return v !== null && v >= imageCircle[0]!; });
    if (imageCircle[1] !== null) result = result.filter(l => { const v = parseNum(l.maxImageCircle); return v !== null && v <= imageCircle[1]!; });

    return result;
  }, [lenses, allLenses, needsAllLenses, filters]);

  const handleToggleCompare = (lens: SupplierLens) => {
    setSelectedForCompare(prev => {
      if (prev.some(l => l.id === lens.id)) return prev.filter(l => l.id !== lens.id);
      if (prev.length >= 3) return prev;
      return [...prev, lens];
    });
  };

  const handleSelectLens = (lens: SupplierLens) => {
    setSelectedLens(lens);
    setDetailsOpen(true);
  };

  if (userError && process.env.NODE_ENV === 'production') {
    return (
      <div className='flex h-screen items-center justify-center bg-background'>
        <div className='w-full max-w-md p-8 text-center'>
          <h2 className='text-2xl font-bold text-destructive'>Authentication Error</h2>
          <p className='mt-2 text-muted-foreground'>Could not sign in to Firebase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen bg-background'>
      <div className='w-1/3 border-r'>
        <SupplierFilterSidebar
          filters={filters}
          setFilters={setFilters}
          resetFilters={() => setFilters(initialFilters)}
          sensorSizes={filterOptions.sensorSizes}
          mountTypes={filterOptions.mountTypes}
          suppliers={filterOptions.suppliers}
          origins={filterOptions.origins}
          lensesCount={filteredLenses.length}
          totalLensesCount={totalCount}
          isLoading={isLoading || isFetchingAll}
        />
      </div>
      <div className='w-2/3 flex flex-col'>
        <SupplierHeader
          searchQuery={filters.searchQuery}
          onSearchChange={q => setFilters(prev => ({ ...prev, searchQuery: q }))}
        >
          <SupplierExcelImport
            onAppend={handleAppend}
            onReplace={handleReplace}
            isDisabled={isLoading || isFetchingAll || isImporting}
          />
        </SupplierHeader>
        <main className='flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8'>
          <CompareBar
            selected={selectedForCompare as any}
            onRemove={id => setSelectedForCompare(prev => prev.filter(l => l.id !== id))}
            onCompare={() => setCompareOpen(true)}
            onClear={() => setSelectedForCompare([])}
          />
          <SupplierProductList
            lenses={filteredLenses}
            isLoading={isLoading || (needsAllLenses && isFetchingAll) || isImporting}
            onSelectLens={handleSelectLens}
            selectedForCompare={selectedForCompare}
            onToggleCompare={handleToggleCompare}
            hasMore={!needsAllLenses && hasMore}
            onLoadMore={loadMore}
          />
        </main>
      </div>
      {selectedLens && (
        <SupplierProductDetails
          lens={selectedLens}
          open={isDetailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
      {selectedForCompare.length >= 2 && (
        <LensComparison
          lenses={selectedForCompare as unknown as Lens[]}
          open={isCompareOpen}
          onOpenChange={setCompareOpen}
        />
      )}
    </div>
  );
}