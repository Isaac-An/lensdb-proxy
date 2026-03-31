'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierFilterSidebar } from './supplier-filter-sidebar';
import { SupplierHeader } from './supplier-header';
import { SupplierProductList } from './supplier-product-list';
import { SupplierProductDetails } from './supplier-product-details';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore';
import { LensComparison } from '../lens-comparison';
import { CompareBar } from '../compare-bar';
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
  sortOrder: 'none',
};

const PAGE_SIZE = 40;
const FETCH_ALL_BATCH = 500;

export function SupplierDashboardPage() {
  const { firestore, isUserLoading, userError } = useFirebase();
  const [filters, setFilters] = useState<SupplierFilters>(initialFilters);
  const [lenses, setLenses] = useState<SupplierLens[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const lastDocRef = useRef<any>(null);
  const [allLenses, setAllLenses] = useState<SupplierLens[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const fetchIdRef = useRef(0);
  const fetchAllIdRef = useRef(0);
  const [selectedLens, setSelectedLens] = useState<SupplierLens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<SupplierLens[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);

  // Derive filter dropdown options from the full dataset — guaranteed to reflect all 2997 lenses
  const filterOptions = useMemo(() => {
    if (allLenses.length === 0) return { mountTypes: [], suppliers: [], origins: [], sensorSizes: [] };
    const mountTypes = [...new Set(allLenses.map(l => l.mountType).filter(Boolean))].sort() as string[];
    const suppliers = [...new Set(allLenses.map(l => l.supplier).filter(Boolean))].sort() as string[];
    const origins = [...new Set(allLenses.map(l => l.countryOfOrigin).filter(Boolean))].sort() as string[];
    const sensorSizes = [...new Set(allLenses.flatMap(l =>
      typeof l.sensorSize === 'string'
        ? l.sensorSize.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(l.sensorSize) ? l.sensorSize : []
    ))].sort() as string[];
    return { mountTypes, suppliers, origins, sensorSizes };
  }, [allLenses]);

  const buildConstraints = useCallback((f: SupplierFilters) => {
    const c: any[] = [];
    if (f.mountType !== 'all') c.push(where('mountType', '==', f.mountType));
    if (f.supplier !== 'all') c.push(where('supplier', '==', f.supplier));
    // origin is always client-side (supports 'non-china' special value)
    return c;
  }, []);

  const fetchLenses = useCallback(async (reset: boolean, currentFilters: SupplierFilters) => {
    if (!firestore) return;
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      const col = collection(firestore, 'supplier_lenses');
      const constraints = buildConstraints(currentFilters);
      const q = query(
        col,
        ...constraints,
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
          const countSnap = await getCountFromServer(query(col, ...constraints));
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
  }, [firestore, buildConstraints]);

  const fetchAllForSearch = useCallback(async (currentFilters: SupplierFilters) => {
    if (!firestore) return;
    const fetchAllId = ++fetchAllIdRef.current;
    setIsFetchingAll(true);
    setAllLenses([]);
    try {
      const col = collection(firestore, 'supplier_lenses');
      const constraints = buildConstraints(currentFilters);
      let lastDoc: any = null;
      const accumulated: SupplierLens[] = [];
      while (true) {
        if (fetchAllId !== fetchAllIdRef.current) return;
        const q = query(
          col,
          ...constraints,
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
  }, [firestore, buildConstraints]);

  const needsAllLenses = useMemo(() => {
    const { searchQuery, efl, fNo, fovD, fovH, ttl, sensorSize, origin } = filters;
    return !!(
      searchQuery ||
      sensorSize !== 'all' ||
      origin !== 'all' ||
      efl[0] !== null || efl[1] !== null ||
      fNo[0] !== null || fNo[1] !== null ||
      fovD[0] !== null || fovD[1] !== null ||
      fovH[0] !== null || fovH[1] !== null ||
      ttl[0] !== null || ttl[1] !== null
    );
  }, [filters]);

  useEffect(() => {
    if (!firestore) return;
    lastDocRef.current = null;
    fetchLenses(true, filters);
  }, [firestore, filters.mountType, filters.supplier]);

  useEffect(() => {
    if (!firestore) return;
    fetchAllForSearch(filters);
  }, [firestore, filters.mountType, filters.supplier]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) fetchLenses(false, filters);
  }, [isLoading, hasMore, fetchLenses, filters]);

  const filteredLenses = useMemo(() => {
    const source = needsAllLenses ? allLenses : lenses;
    let result = [...source];
    const { searchQuery, efl, fNo, fovD, fovH, ttl, sensorSize, origin } = filters;
    if (searchQuery) result = result.filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (origin === 'non-china') {
      result = result.filter(l => l.countryOfOrigin?.toLowerCase() !== 'china');
    } else if (origin !== 'all') {
      result = result.filter(l => l.countryOfOrigin === origin);
    }
    if (sensorSize !== 'all') result = result.filter(l => {
      if (typeof l.sensorSize === 'string') return l.sensorSize.includes(sensorSize);
      if (Array.isArray(l.sensorSize)) return l.sensorSize.includes(sensorSize);
      return false;
    });
    if (efl[0] !== null) result = result.filter(l => parseFloat(String(l.efl)) >= efl[0]!);
    if (efl[1] !== null) result = result.filter(l => parseFloat(String(l.efl)) <= efl[1]!);
    if (fNo[0] !== null) result = result.filter(l => parseFloat(String(l.fNo)) >= fNo[0]!);
    if (fNo[1] !== null) result = result.filter(l => parseFloat(String(l.fNo)) <= fNo[1]!);
    if (fovD[0] !== null) result = result.filter(l => parseFloat(String(l.fovD)) >= fovD[0]!);
    if (fovD[1] !== null) result = result.filter(l => parseFloat(String(l.fovD)) <= fovD[1]!);
    if (ttl[0] !== null) result = result.filter(l => parseFloat(String(l.ttl)) >= ttl[0]!);
    if (ttl[1] !== null) result = result.filter(l => parseFloat(String(l.ttl)) <= ttl[1]!);
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
            isLoading={isLoading || (needsAllLenses && isFetchingAll)}
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
