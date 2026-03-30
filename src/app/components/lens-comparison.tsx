'use client';

import React, { useState } from 'react';
import type { Lens } from '@/app/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type LensComparisonProps = {
  lenses: Lens[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const fields: { key: keyof Lens; label: string; unit?: string }[] = [
  { key: 'sensorSize', label: 'Sensor size' },
  { key: 'efl', label: 'EFL', unit: 'mm' },
  { key: 'maxImageCircle', label: 'Max image circle', unit: 'mm' },
  { key: 'fNo', label: 'F. No.' },
  { key: 'fovD', label: 'FOV diagonal', unit: '°' },
  { key: 'fovH', label: 'FOV horizontal', unit: '°' },
  { key: 'fovV', label: 'FOV vertical', unit: '°' },
  { key: 'ttl', label: 'TTL', unit: 'mm' },
  { key: 'tvDistortion', label: 'TV distortion', unit: '%' },
  { key: 'relativeIllumination', label: 'Relative illumination', unit: '%' },
  { key: 'chiefRayAngle', label: 'Chief ray angle', unit: '°' },
  { key: 'mountType', label: 'Mount type' },
  { key: 'lensStructure', label: 'Lens structure' },
  { key: 'price', label: 'Price' },
];

function formatVal(val: string | null | undefined, unit?: string) {
  if (!val || val.trim() === '') return 'N/A';
  return unit ? `${val}${unit}` : val;
}

function isDifferent(lenses: Lens[], key: keyof Lens) {
  const vals = lenses.map(l => String(l[key] ?? '').trim());
  return vals.some(v => v !== vals[0]);
}

export function LensComparison({ lenses, open, onOpenChange }: LensComparisonProps) {
  const [diffOnly, setDiffOnly] = useState(false);

  const visibleFields = diffOnly
    ? fields.filter(f => isDifferent(lenses, f.key))
    : fields;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-5xl w-[95vw] overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-xl">Lens comparison</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-3 mb-6">
          <Switch id="diff-toggle" checked={diffOnly} onCheckedChange={setDiffOnly} />
          <Label htmlFor="diff-toggle" className="text-sm cursor-pointer">
            Show differences only
          </Label>
          {diffOnly && (
            <Badge variant="secondary">{visibleFields.length} difference{visibleFields.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 w-44 text-muted-foreground font-medium border-b" />
                {lenses.map(lens => (
                  <th key={lens.id} className="text-left p-3 border-b font-medium min-w-40">
                    <div className="flex flex-col gap-1">
                      <span>{lens.name}</span>
                      {lens.pdfUrl && lens.pdfUrl.startsWith('https://') && (
                        <a href={lens.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <FileText className="h-3 w-3" />
                          View PDF
                        </a>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleFields.length === 0 && diffOnly ? (
                <tr>
                  <td colSpan={lenses.length + 1} className="p-6 text-center text-muted-foreground">
                    All fields are identical across selected lenses.
                  </td>
                </tr>
              ) : (
                visibleFields.map((field, i) => {
                  const different = isDifferent(lenses, field.key);
                  return (
                    <tr key={field.key} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="p-3 text-muted-foreground font-medium">{field.label}</td>
                      {lenses.map(lens => (
                        <td key={lens.id}
                          className={`p-3 ${different ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                          {formatVal(lens[field.key] as string, field.unit)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
