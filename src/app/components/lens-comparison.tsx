'use client';

import React, { useState } from 'react';
import type { Lens } from '@/app/lib/types';
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
  { key: 'tvDistortion', label: 'Distortion', unit: '%' },
  { key: 'relativeIllumination', label: 'Relative illumination', unit: '%' },
  { key: 'chiefRayAngle', label: 'Chief ray angle', unit: '°' },
  { key: 'mountType', label: 'Mount type' },
  { key: 'lensStructure', label: 'Lens structure' },
  { key: 'price', label: 'Price' },
];

const TEXT = 'rgba(76,76,76,1)';
const TEXT_MUTED = 'rgba(28,28,28,1)';

function formatVal(val: string | null | undefined, unit?: string) {
  if (!val || val.trim() === '') return '—';
  return unit ? `${val}${unit}` : val;
}

function isDifferent(lenses: Lens[], key: keyof Lens) {
  const vals = lenses.map(l => String(l[key] ?? '').trim());
  return vals.some(v => v !== vals[0]);
}

export function LensComparison({ lenses, open, onOpenChange }: LensComparisonProps) {
  const [diffOnly, setDiffOnly] = useState(false);

  if (!open) return null;

  const visibleFields = diffOnly
    ? fields.filter(f => isDifferent(lenses, f.key))
    : fields.filter(f => {
        if (f.key === 'price') return lenses.some(l => l.price && String(l.price).trim() !== '');
        return true;
      });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{
          background: 'rgba(100,100,100,0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Glass popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto relative w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col"
          style={{
            background: 'rgba(255, 255, 255, 1)',
            backdropFilter: 'blur(20px) saturate(200%)',
            WebkitBackdropFilter: 'blur(200px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,1) inset',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgb(134,134,134)' }}>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>Lens comparison</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Switch id="diff-toggle" checked={diffOnly} onCheckedChange={setDiffOnly} />
                <Label htmlFor="diff-toggle" className="text-sm cursor-pointer" style={{ color: TEXT_MUTED }}>
                  Show differences only
                </Label>
                {diffOnly && (
                  <Badge style={{ background: 'rgba(255,255,255,0.4)', color: TEXT, border: '1px solid rgba(134,134,134,0.4)' }}>
                    {visibleFields.length} difference{visibleFields.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} style={{ color: TEXT_MUTED }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1 p-6 pt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-3 w-44 font-medium" style={{ color: TEXT_MUTED, borderBottom: '1px solid rgb(134,134,134)' }} />
                  {lenses.map(lens => (
                    <th key={lens.id} className="text-left p-3 font-semibold min-w-40" style={{ color: TEXT, borderBottom: '1px solid rgb(134,134,134)' }}>
                      <div className="flex flex-col gap-1">
                        <span>{lens.name}</span>
                        {lens.pdfUrl && lens.pdfUrl.startsWith('https://') && (
                          <a href={lens.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs hover:underline"
                            style={{ color: TEXT_MUTED }}>
                            <FileText className="h-3 w-3" />View PDF
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
                    <td colSpan={lenses.length + 1} className="p-6 text-center" style={{ color: TEXT_MUTED }}>
                      All fields are identical across selected lenses.
                    </td>
                  </tr>
                ) : (
                  visibleFields.map((field, i) => {
                    const different = isDifferent(lenses, field.key);
                    return (
                      <tr key={field.key} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.3)' : 'transparent' }}>
                        <td className="p-3 font-medium" style={{ color: TEXT_MUTED }}>{field.label}</td>
                        {lenses.map(lens => (
                          <td key={lens.id} className="p-3" style={{ color: different ? 'rgb(160,100,0)' : TEXT, fontWeight: different ? 500 : 400 }}>
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
        </div>
      </div>
    </>
  );
}