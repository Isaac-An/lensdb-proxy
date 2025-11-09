
'use client';

import React from 'react';
import type { Lens } from '@/app/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

type ProductDetailsProps = {
  lens: Lens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductDetails({ lens, open, onOpenChange }: ProductDetailsProps) {

    if (!lens) return null;

    const hasPdfUrl = lens.pdfUrl && lens.pdfUrl.startsWith('https://');

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
                    <Separator />
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">PDF Document</p>
                        {hasPdfUrl ? (
                            <Button asChild variant="outline" size="sm">
                                <a href={lens.pdfUrl} target="_blank" rel="noopener noreferrer">
                                    <FileText className="mr-2 h-4 w-4" />
                                    View
                                </a>
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not Available</p>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
);
