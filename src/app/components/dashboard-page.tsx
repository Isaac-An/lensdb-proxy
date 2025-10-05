'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { lenses as allLensesData, SENSOR_SIZES, MOUNT_TYPES } from '@/app/lib/data';
import type { Lens } from '@/app/lib/types';
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { FilterSidebar } from './filter-sidebar';
import { AppHeader } from './header';
import { ProductList } from './product-list';
import { ProductDetails } from './product-details';
import { getAIInsights } from '../actions';
import { AiInsightsDialog } from './ai-insights-dialog';
import { useToast } from '@/hooks/use-toast';

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

export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [isAiInsightOpen, setAiInsightOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const filteredLenses = useMemo(() => {
    return allLensesData.filter(lens => {
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
  }, [filters]);

  const handleSelectLens = (lens: Lens) => {
    setSelectedLens(lens);
    setDetailsOpen(true);
  };
  
  const handleGenerateInsights = () => {
    startTransition(async () => {
      const result = await getAIInsights(filteredLenses);
      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error Generating Insights',
          description: result.error,
        });
      } else {
        setAiInsight(result.insights);
        setAiInsightOpen(true);
      }
    });
  };

  const handleImport = () => {
    toast({ title: 'Feature in development', description: 'Excel import will be available soon.' });
  }

  const handleUpload = () => {
    toast({ title: 'Feature in development', description: 'Excel upload will be available soon.' });
  }

  return (
    <SidebarProvider>
      <FilterSidebar 
        filters={filters} 
        setFilters={setFilters} 
        resetFilters={() => setFilters(initialFilters)}
        sensorSizes={SENSOR_SIZES}
        mountTypes={MOUNT_TYPES}
      />
      <SidebarInset>
        <div className="flex flex-col h-screen">
            <AppHeader
              searchQuery={filters.searchQuery}
              onSearchChange={(query) => setFilters(prev => ({...prev, searchQuery: query}))}
              onGenerateInsights={handleGenerateInsights}
              isGeneratingInsights={isPending}
              onImport={handleImport}
              onUpload={handleUpload}
            />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <ProductList lenses={filteredLenses} onSelectLens={handleSelectLens} />
            </main>
        </div>
      </SidebarInset>

      {selectedLens && (
        <ProductDetails 
          lens={selectedLens} 
          open={isDetailsOpen} 
          onOpenChange={setDetailsOpen} 
        />
      )}
      
      <AiInsightsDialog
        open={isAiInsightOpen}
        onOpenChange={setAiInsightOpen}
        insights={aiInsight}
      />
    </SidebarProvider>
  );
}
