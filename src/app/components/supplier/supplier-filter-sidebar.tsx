'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SupplierFilters } from './supplier-dashboard-page';

type FilterSidebarProps = {
  filters: SupplierFilters;
  setFilters: React.Dispatch<React.SetStateAction<SupplierFilters>>;
  resetFilters: () => void;
  sensorSizes: string[];
  mountTypes: string[];
  suppliers: string[];
  origins: string[];
  lensesCount: number;
  totalLensesCount: number;
  isLoading: boolean;
};

export function SupplierFilterSidebar({
  filters,
  setFilters,
  resetFilters,
  sensorSizes,
  mountTypes,
  suppliers,
  origins,
  lensesCount,
  totalLensesCount,
  isLoading,
}: FilterSidebarProps) {

  const handleRangeChange = (
    field: 'efl' | 'fNo' | 'fovD' | 'fovH' | 'ttl' | 'imageCircle',
    index: 0 | 1,
    value: string
  ) => {
    const numValue = value === '' ? null : Number(value);
    const newRange = [...filters[field]] as [number | null, number | null];
    newRange[index] = numValue;
    setFilters(prev => ({ ...prev, [field]: newRange }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Filters</h2>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        </div>
        <p className="pt-2 text-sm text-muted-foreground">
          Last synced: {new Date().toLocaleDateString()}
        </p>
        <p className="pt-2 text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : `Total lenses in DB: ${totalLensesCount}`}
        </p>
        <p className="pt-1 text-sm font-semibold text-muted-foreground">
          {isLoading ? 'Loading...' : `Lenses shown: ${lensesCount}`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <Accordion type="multiple" defaultValue={['attributes', 'numeric']} className="w-full">
            <AccordionItem value="attributes">
              <AccordionTrigger>Attributes</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">

                <div className="space-y-2">
                  <Label>Sort by Name</Label>
                  <Select
                    value={filters.sortOrder}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' | 'none' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="asc">A-Z</SelectItem>
                      <SelectItem value="desc">Z-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={filters.supplier}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, supplier: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origin</Label>
                  <Select
                    value={filters.origin}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, origin: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Origins</SelectItem>
                      <SelectItem value="non-china">Non-China</SelectItem>
                      {origins.map(origin => (
                        <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sensor Size</Label>
                  <Select
                    value={filters.sensorSize}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, sensorSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sensor size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      {sensorSizes.map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mount Type</Label>
                  <Select
                    value={filters.mountType}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, mountType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Mounts</SelectItem>
                      {mountTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="numeric">
              <AccordionTrigger>Numeric Ranges</AccordionTrigger>
              <AccordionContent className="space-y-6 pt-4">
                {renderRangeFilter('EFL (mm)', 'efl', filters, handleRangeChange)}
                {renderRangeFilter('F. No.', 'fNo', filters, handleRangeChange)}
                {renderRangeFilter('Max Image Circle (mm)', 'imageCircle', filters, handleRangeChange)}
                {renderRangeFilter('FOV - Diagonal (°)', 'fovD', filters, handleRangeChange)}
                {renderRangeFilter('FOV - Horizontal (°)', 'fovH', filters, handleRangeChange)}
                {renderRangeFilter('TTL (mm)', 'ttl', filters, handleRangeChange)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function renderRangeFilter(
  label: string,
  field: 'efl' | 'fNo' | 'fovD' | 'fovH' | 'ttl' | 'imageCircle',
  filters: SupplierFilters,
  handler: (field: 'efl' | 'fNo' | 'fovD' | 'fovH' | 'ttl' | 'imageCircle', index: 0 | 1, value: string) => void
) {
  return (
    <div key={field} className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={filters[field][0] ?? ''}
          onChange={(e) => handler(field, 0, e.target.value)}
          className="text-sm"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          value={filters[field][1] ?? ''}
          onChange={(e) => handler(field, 1, e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  );
}
