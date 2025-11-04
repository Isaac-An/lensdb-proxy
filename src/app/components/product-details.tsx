'use client';

import React, { useState, useEffect } from 'react';
import type { Lens } from '@/app/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useFirebaseApp } from '@/firebase';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

type ProductDetailsProps = {
  lens: Lens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductDetails({ lens, open, onOpenChange }: ProductDetailsProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const firebaseApp = useFirebaseApp();

  useEffect(() => {
    // Reset pdfUrl when the sheet is closed or the lens changes
    setPdfUrl(null);

    if (open && lens && firebaseApp) {
      const storage = getStorage(firebaseApp);
      // Create a reference to the file based on the lens name
      const pdfRef = ref(storage, `${lens.name}.pdf`);

      // Get the download URL
      getDownloadURL(pdfRef)
        .then((url) => {
          // If successful, set the URL in state
          setPdfUrl(url);
        })
        .catch((error) => {
          // If the file doesn't exist or another error occurs, log it and do nothing.
          // The button won't be rendered if pdfUrl remains null.
          console.log(`No PDF found for ${lens.name}:`, error.code);
        });
    }
  }, [lens, open, firebaseApp]);


  if (!lens) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">{lens.name}</SheetTitle>
          <SheetDescription>
            Detailed specifications for {lens.name}.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-4">
            <DetailItem label="Sensor Size" value={lens.sensorSize} />
            <Separator />
            <DetailItem label="Effective Focal Length (EFL)" value={`${lens.efl} mm`} />
            <DetailItem label="Max Image Circle" value={`${lens.maxImageCircle} mm`} />
            <DetailItem label="F. No." value={lens.fNo} />
            <DetailItem label="Diagonal FOV" value={`${lens.fovD}°`} />
            <DetailItem label="Horizontal FOV" value={`${lens.fovH}°`} />
            <DetailItem label="Vertical FOV" value={`${lens.fovV}°`} />
            <Separator />
            <DetailItem label="Total Track Length (TTL)" value={`${lens.ttl} mm`} />
            <DetailItem label="TV Distortion" value={`${lens.tvDistortion}%`} />
            <DetailItem label="Relative Illumination" value={`${lens.relativeIllumination}%`} />
            <DetailItem label="Chief Ray Angle" value={`${lens.chiefRayAngle}°`} />
            <Separator />
            <DetailItem label="Mount Type" value={lens.mountType} />
            <DetailItem label="Lens Structure" value={lens.lensStructure} />
        </div>
        {pdfUrl && (
          <SheetFooter className="pt-6">
            <Button asChild className="w-full">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                View PDF
              </a>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

const DetailItem = ({ label, value, isPrimary = false }: { label: string, value: React.ReactNode, isPrimary?: boolean }) => (
    <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${isPrimary ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
)
