'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SidebarTrigger
} from "@/components/ui/sidebar";
import { FileInput, Loader2, Search, Sparkles, Upload } from 'lucide-react';
import React, { useRef } from 'react';

type AppHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onGenerateInsights: () => void;
  isGeneratingInsights: boolean;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
};

export function AppHeader({
  searchQuery,
  onSearchChange,
  onGenerateInsights,
  isGeneratingInsights,
  onImport,
  onUpload
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-lg font-semibold md:text-xl">
          Appleye Lens Database
        </h1>
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
        <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleImportClick}>
                <FileInput />
                Import
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImport}
              className="hidden"
              accept=".xlsx, .xls, .csv"
            />
            <Button variant="outline" size="sm" onClick={onUpload}>
                <Upload />
                Upload
            </Button>
        </div>
        <Button size="sm" onClick={onGenerateInsights} disabled={isGeneratingInsights}>
          {isGeneratingInsights ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          Generate Insights
        </Button>
      </div>
    </header>
  );
}
