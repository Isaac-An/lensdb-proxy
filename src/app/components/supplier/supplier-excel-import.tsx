'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1G1DBDJ3drEyAWmm3v6NavFB0c-lPxQTxfcxcogECZf4/edit";

interface SupplierExcelImportProps {
  onAppend: (lenses: any[]) => void;
  onReplace: (lenses: any[]) => void;
  isDisabled: boolean;
}

export function SupplierExcelImport({ isDisabled }: SupplierExcelImportProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isDisabled}
      onClick={() => window.open(SHEET_URL, '_blank')}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Edit Database
    </Button>
  );
}