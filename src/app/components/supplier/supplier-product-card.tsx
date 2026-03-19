'use client';

import React from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ProductCardProps = {
  lens: SupplierLens;
  onSelectLens: (lens: SupplierLens) => void;
};

export function SupplierProductCard({ lens, onSelectLens }: ProductCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
      <CardHeader>
        <CardTitle className="text-base font-bold mb-2 truncate">{lens.name}</CardTitle>
        {lens.supplier && <Badge variant="secondary">{lens.supplier}</Badge>}
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-0">
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>EFL:</strong> {lens.efl || '-'}mm</p>
          <p><strong>F. No.:</strong> {lens.fNo || '-'}</p>
          <p><strong>Mount:</strong> {lens.mountType || '-'}</p>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onSelectLens(lens)}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
