'use client';

import React from 'react';
import Image from 'next/image';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type ProductCardProps = {
  lens: Lens;
  onSelectLens: (lens: Lens) => void;
};

const getImageUrl = (id: string) => {
    const numericId = parseInt(id.split('-')[1]);
    const image = PlaceHolderImages[numericId-1];
    return image ? image.imageUrl : 'https://picsum.photos/seed/default/600/400';
}
const getImageHint = (id: string) => {
    const numericId = parseInt(id.split('-')[1]);
    const image = PlaceHolderImages[numericId-1];
    return image ? image.imageHint : 'camera lens';
}

export function ProductCard({ lens, onSelectLens }: ProductCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="p-0">
        <Image
          src={getImageUrl(lens.id)}
          alt={`Image of ${lens.name}`}
          width={600}
          height={400}
          className="rounded-t-lg object-cover aspect-[3/2]"
          data-ai-hint={getImageHint(lens.id)}
        />
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <CardTitle className="text-base font-bold mb-2 truncate">{lens.name}</CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>EFL:</strong> {lens.efl}mm</p>
          <p><strong>F. No.:</strong> {lens.fNo}</p>
          <p><strong>Mount:</strong> {lens.mountType}</p>
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
