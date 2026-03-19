'use client';

import React, { useState, useMemo } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { SupplierFilterSidebar } from './supplier-filter-sidebar';
import { SupplierHeader } from './supplier-header';
import { SupplierProductList } from './supplier-product-list';
import { SupplierProductDetails } from './supplier-product-details';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

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


export function SupplierDashboardPage() {
  const { firestore } = useFirebase();
  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'supplier_lenses') : null, [firestore]);
  const { data: lenses = [], isLoading: isLoadingLenses } = useCollection<SupplierLens>(productsCollection);
  
  const [filters, setFilters] = useState<SupplierFilters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<SupplierLens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  
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

  const isLoading = isLoadingLenses;

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
        />
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
    </div>
  );
}
