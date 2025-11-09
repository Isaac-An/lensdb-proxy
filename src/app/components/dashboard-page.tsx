
'use client';

import React, { useState, useMemo } from 'react';
import type { Lens } from '@/app/lib/types';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { useToast } from '@/hooks/use-toast';
import { lenses as initialLenses } from '@/app/lib/data';
import { ExcelImport } from './excel-import';

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

export function DashboardPage() {
  const [lenses, setLenses] = useState<Lens[]>(initialLenses);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  
  const { toast } = useToast();

  const handleImport = (importedLenses: Lens[]) => {
    if (lenses.length > 0) {
      if (!confirm('This will overwrite the current lens data. Are you sure?')) {
        return;
      }
    }
    setLenses(importedLenses);
    toast({
      title: 'Import Successful',
      description: `Successfully loaded ${importedLenses.length} lenses from the file.`,
    });
  };

  const handleAppend = (lensesToAppend: Lens[]) => {
    const existingLensNames = new Set(lenses.map(l => l.name));
    const newLenses = lensesToAppend.filter(l => !existingLensNames.has(l.name));
    const duplicateLenses = lensesToAppend.filter(l => existingLensNames.has(l.name));

    if (newLenses.length > 0) {
      setLenses(prevLenses => [...prevLenses, ...newLenses]);
    }
    
    let description = `${newLenses.length} new lens(es) imported.`;
    if (duplicateLenses.length > 0) {
      description += ` ${duplicateLenses.length} duplicate(s) were skipped: ${duplicateLenses.map(l => l.name).join(', ')}`;
    }

    toast({
      title: 'Append Complete',
      description: description.trim(),
    });
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
    
    const baseSensorSizes = lenses.map(l => {
      const size = l.sensorSize || '';
      const spaceIndex = size.indexOf(' ');
      return spaceIndex !== -1 ? size.substring(0, spaceIndex) : size;
    }).filter(Boolean);

    const sensorNames = [...new Set(lenses.map(l => {
        const size = l.sensorSize || '';
        const parts = size.split(' ');
        if (parts.length > 1 && parts[0].includes('"')) {
            return parts[1];
        }
        return null;
    }).filter(Boolean) as string[])].sort();

    const uniqueSensorSizes = [...new Set(baseSensorSizes)];
    const sortedSensorSizes = uniqueSensorSizes.sort(customSensorSort);
    const mountTypes = [...new Set(lenses.map(l => l.mountType).filter(Boolean))].sort();
    return { sensorSizes: sortedSensorSizes, mountTypes, sensorNames };
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    const { searchQuery, sensorSize, mountType, efl, fNo, fovD, ttl, sortOrder, sensorName } = filters;
  
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
          <ExcelImport onImport={handleImport} onAppend={handleAppend} />
        </AppHeader>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <ProductList lenses={filteredLenses} isLoading={false} onSelectLens={handleSelectLens} />
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
