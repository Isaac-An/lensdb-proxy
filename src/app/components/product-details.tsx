
'use client';

import React, { useState, useEffect } from 'react';
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
import { FileText, Loader2 } from 'lucide-react';
import { getStorageFileUrl } from '@/app/actions';

type ProductDetailsProps = {
  lens: Lens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductDetails({ lens, open, onOpenChange }: ProductDetailsProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);

    useEffect(() => {
        if (!open || !lens) {
            setPdfUrl(null);
            setIsLoadingPdf(false);
            return;
        }

        const fetchPdfUrl = async () => {
            setIsLoadingPdf(true);
            setPdfUrl(null);

            let fileNameToFetch: string | undefined;

            if (lens.pdfUrl && lens.pdfUrl.trim() && !lens.pdfUrl.startsWith('https://')) {
                // Use pdfUrl as filename if it exists and is not a full URL
                fileNameToFetch = lens.pdfUrl.trim();
            } else if (!lens.pdfUrl || lens.pdfUrl.trim() === '') {
                // Generate filename from name if pdfUrl is empty
                fileNameToFetch = `${lens.name.trim()}.pdf`;
            }

            // Attempt to fetch from storage if we determined a filename
            if (fileNameToFetch) {
                try {
                    const result = await getStorageFileUrl({ fileName: fileNameToFetch });
                    if (result.url) {
                        setPdfUrl(result.url);
                        setIsLoadingPdf(false);
                        return; // Success, we are done.
                    }
                } catch (error) {
                    console.error("Error fetching signed URL from storage:", error);
                }
            }

            // Fallback: If fetch failed or wasn't attempted, check if pdfUrl is a direct link
            if (lens.pdfUrl && lens.pdfUrl.startsWith('https://')) {
                setPdfUrl(lens.pdfUrl);
            } else {
                setPdfUrl(null); // Ensure no URL is set if all attempts fail
            }

            setIsLoadingPdf(false);
        };

        fetchPdfUrl();
    }, [lens, open]);

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
                    <Separator />
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">PDF Document</p>
                        {isLoadingPdf ? (
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                            </div>
                        ) : pdfUrl ? (
                            <Button asChild variant="outline" size="sm">
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
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
