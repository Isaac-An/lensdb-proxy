'use client';

import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';

type SupplierHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  children?: React.ReactNode;
};

export function SupplierHeader({
  searchQuery,
  onSearchChange,
  children,
}: SupplierHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold md:text-xl whitespace-nowrap">
          Appleye Unified Supplier Lenses
        </h1>
        <Button asChild variant="outline" size="sm">
          <a href="/">My Database</a>
        </Button>
      </div>

      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </form>
        {children}
      </div>
    </header>
  );
}
