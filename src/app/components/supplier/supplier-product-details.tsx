'use client';
import React, { useState, useMemo } from 'react';
import type { SupplierLens } from '@/app/lib/types';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProductDetailsProps = {
  lens: SupplierLens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SENSOR_PRESETS: Record<string, { w: number; h: number; d: number }> = {
  '1" (12.8x9.6mm)':         { w: 12.8,  h: 9.6,   d: 16.0  },
  '1/1.2" (10.67x8mm)':      { w: 10.67, h: 8,     d: 13.33 },
  '1/1.72" (9.07x5.1mm)':    { w: 9.07,  h: 5.1,   d: 10.42 },
  '1/1.8" (7.18x5.32mm)':    { w: 7.18,  h: 5.32,  d: 8.93  },
  '1/2" (6.4x4.8mm)':        { w: 6.4,   h: 4.8,   d: 8.0   },
  '1/2.3" (6.16x4.62mm)':    { w: 6.16,  h: 4.62,  d: 7.70  },
  '1/2.4" (5.79x4.01mm)':    { w: 5.79,  h: 4.01,  d: 7.04  },
  '1/2.44" (5.67x3.89mm)':   { w: 5.67,  h: 3.89,  d: 6.87  },
  '1/2.5" (5.76x4.29mm)':    { w: 5.76,  h: 4.29,  d: 7.18  },
  '1/2.53" (5.70x4.28mm)':   { w: 5.70,  h: 4.28,  d: 7.13  },
  '1/2.6" (5.55x4.17mm)':    { w: 5.55,  h: 4.17,  d: 6.94  },
  '1/2.7" (5.37x4.04mm)':    { w: 5.37,  h: 4.04,  d: 6.71  },
  '1/2.8" (5.12x3.84mm)':    { w: 5.12,  h: 3.84,  d: 6.40  },
  '1/2.9" (4.96x3.72mm)':    { w: 4.96,  h: 3.72,  d: 6.20  },
  '1/3" (4.8x3.6mm)':        { w: 4.8,   h: 3.6,   d: 6.0   },
  '1/3.2" (4.54x3.42mm)':    { w: 4.54,  h: 3.42,  d: 5.68  },
  '1/3.6" (4x3mm)':          { w: 4,     h: 3,     d: 5.0   },
  '1/3.9" (3.69x2.77mm)':    { w: 3.69,  h: 2.77,  d: 4.61  },
  '1/4" (3.2x2.4mm)':        { w: 3.2,   h: 2.4,   d: 4.0   },
  '1/4.3" (2.98x2.23mm)':    { w: 2.98,  h: 2.23,  d: 3.72  },
  '1/4.5" (2.84x2.13mm)':    { w: 2.84,  h: 2.13,  d: 3.55  },
  '1/5" (2.88x2.16mm)':      { w: 2.88,  h: 2.16,  d: 3.60  },
  '1/6" (2.4x1.8mm)':        { w: 2.4,   h: 1.8,   d: 3.0   },
  '1/7" (2.16x1.62mm)':      { w: 2.16,  h: 1.62,  d: 2.70  },
  '1/7.25" (2.09x1.57mm)':   { w: 2.09,  h: 1.57,  d: 2.61  },
  '1/7.5" (2.0x1.5mm)':      { w: 2.0,   h: 1.5,   d: 2.5   },
  '1/9" (1.6x1.2mm)':        { w: 1.6,   h: 1.2,   d: 2.0   },
  '1/10" (1.28x0.96mm)':     { w: 1.28,  h: 0.96,  d: 1.60  },
  'APS-C (23.5x15.6mm)':     { w: 23.5,  h: 15.6,  d: 28.21 },
  'AR0145 (1/4.3")':          { w: 2.98,  h: 2.23,  d: 3.72  },
  'AR0234 (1/2.6")':          { w: 5.55,  h: 4.17,  d: 6.94  },
  'AR0246 (1/4")':            { w: 3.2,   h: 2.4,   d: 4.0   },
  'AR0522D (1/2.5")':         { w: 5.76,  h: 4.29,  d: 7.18  },
  'AR0822 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'AR0823AT (1/1.8")':        { w: 7.18,  h: 5.32,  d: 8.93  },
  'AR0830 (1/2.9")':          { w: 4.96,  h: 3.72,  d: 6.20  },
  'AR1335 (1/3.2")':          { w: 4.54,  h: 3.42,  d: 5.68  },
  'AR2020 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'Full Frame (36x24mm)':     { w: 36,    h: 24,    d: 43.27 },
  'GC2053 (1/2.9")':          { w: 4.96,  h: 3.72,  d: 6.20  },
  'GC4023 (1/2.7")':          { w: 5.37,  h: 4.04,  d: 6.71  },
  'IMX178 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'IMX317 (1/2.5")':          { w: 5.76,  h: 4.29,  d: 7.18  },
  'IMX334 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'IMX335 (1/2.8")':          { w: 5.12,  h: 3.84,  d: 6.40  },
  'IMX347 (1/2")':            { w: 6.4,   h: 4.8,   d: 8.0   },
  'IMX377 (1/2.3")':          { w: 6.16,  h: 4.62,  d: 7.70  },
  'IMX385 (1/2")':            { w: 6.4,   h: 4.8,   d: 8.0   },
  'IMX415 (1/2.8")':          { w: 5.12,  h: 3.84,  d: 6.40  },
  'IMX477 (1/2.5")':          { w: 5.76,  h: 4.29,  d: 7.18  },
  'IMX477/IMX378 (1/2.3")':   { w: 6.16,  h: 4.62,  d: 7.70  },
  'IMX568 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'IMX577 (1/2.3")':          { w: 6.16,  h: 4.62,  d: 7.70  },
  'IMX586 (1/2")':            { w: 6.4,   h: 4.8,   d: 8.0   },
  'IMX675 (1/2.8")':          { w: 5.12,  h: 3.84,  d: 6.40  },
  'IMX678 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'IMX728 (1/1.72")':         { w: 9.07,  h: 5.1,   d: 10.42 },
  'MIRA050 (1/7")':           { w: 2.16,  h: 1.62,  d: 2.70  },
  'MIRA220 (1/2.7")':         { w: 5.37,  h: 4.04,  d: 6.71  },
  'OS05A20 (1/2.7")':         { w: 5.37,  h: 4.04,  d: 6.71  },
  'OV2311 (1/2.9")':          { w: 4.96,  h: 3.72,  d: 6.20  },
  'OV5675 (1/5")':            { w: 2.88,  h: 2.16,  d: 3.60  },
  'OV7251 (1/7.5")':          { w: 2.0,   h: 1.5,   d: 2.5   },
  'OX03J10 (1/2.4")':         { w: 5.79,  h: 4.01,  d: 7.04  },
  'OX05B1S (1/2.53")':        { w: 5.70,  h: 4.28,  d: 7.13  },
  'SC301IoT (1/2.8")':        { w: 5.12,  h: 3.84,  d: 6.40  },
  'SC4210 (1/1.8")':          { w: 7.18,  h: 5.32,  d: 8.93  },
  'SC501AI (1/2.7")':         { w: 5.37,  h: 4.04,  d: 6.71  },
  'ST VB1740 (1/3")':         { w: 4.3,   h: 3.2,   d: 5.33  },
  'ST VD1943 (1/2.5")':       { w: 5.76,  h: 4.29,  d: 7.18  },
  'ST VD55G1 (1/10")':        { w: 1.28,  h: 0.96,  d: 1.60  },
  'ST VD56G3 (1/4")':         { w: 3.2,   h: 2.4,   d: 4.0   },
  'VD66GY (1/4")':            { w: 3.2,   h: 2.4,   d: 4.0   },
};

function calcFov(sensorDim: number, efl: number): number {
  return 2 * (180 / Math.PI) * Math.atan(sensorDim / (2 * efl));
}

const TEXT = 'rgba(76,76,76,1)';
const TEXT_MUTED = 'rgba(28,28,28,1)';

const glassStyle = {
  background: 'rgba(255, 255, 255, 1)',
  backdropFilter: 'blur(20px) saturate(200%)',
  WebkitBackdropFilter: 'blur(200px) saturate(200%)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 2px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,1) inset',
} as const;

const backdropStyle = {
  background: 'rgba(100, 100, 100, 0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const;

const divider = <div style={{ height: '1px', background: 'rgb(134, 134, 134)', margin: '4px 0' }} />;

function FovCalculator({ lensEfl }: { lensEfl: string | null | undefined }) {
  const [sensorPreset, setSensorPreset] = useState('');
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [eflOverride, setEflOverride] = useState('');

  const eflNum = useMemo(() => {
    if (eflOverride) return parseFloat(eflOverride);
    return parseFloat(String(lensEfl ?? ''));
  }, [eflOverride, lensEfl]);

  const dims = useMemo(() => {
    if (sensorPreset && sensorPreset !== 'custom' && SENSOR_PRESETS[sensorPreset]) return SENSOR_PRESETS[sensorPreset];
    const w = parseFloat(customW);
    const h = parseFloat(customH);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) return { w, h, d: Math.sqrt(w * w + h * h) };
    return null;
  }, [sensorPreset, customW, customH]);

  const results = useMemo(() => {
    if (!dims || isNaN(eflNum) || eflNum <= 0) return null;
    return {
      horizontal: calcFov(dims.w, eflNum),
      vertical: calcFov(dims.h, eflNum),
      diagonal: calcFov(dims.d, eflNum),
    };
  }, [dims, eflNum]);

  const inputStyle = { background: 'rgba(255, 255, 255, 0.4)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(76, 76, 76, 1)' };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(76, 76, 76, 1)' }}>Sensor</Label>
        <Select value={sensorPreset} onValueChange={v => { setSensorPreset(v); setCustomW(''); setCustomH(''); }}>
          <SelectTrigger className="h-8 text-xs" style={inputStyle}><SelectValue placeholder="Select sensor..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            {Object.keys(SENSOR_PRESETS).map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {(!sensorPreset || sensorPreset === 'custom') && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(76, 76, 76,1)' }}>Custom size (mm)</Label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Width" value={customW} onChange={e => setCustomW(e.target.value)} className="h-8 text-xs" style={inputStyle} />
            <Input type="number" placeholder="Height" value={customH} onChange={e => setCustomH(e.target.value)} className="h-8 text-xs" style={inputStyle} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(76, 76, 76, 1)' }}>EFL (mm)</Label>
        <Input type="number" placeholder={lensEfl ? `${lensEfl} (from lens)` : 'Enter EFL...'} value={eflOverride} onChange={e => setEflOverride(e.target.value)} className="h-8 text-xs" style={inputStyle} />
        {!eflOverride && lensEfl && <p className="text-xs" style={{ color: 'rgba(76, 76, 76, 1)' }}>Using lens EFL: {lensEfl}mm</p>}
      </div>
      {results ? (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {[['Horizontal', results.horizontal], ['Vertical', results.vertical], ['Diagonal', results.diagonal]].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-xs">
              <span style={{ color: 'rgba(76, 76, 76, 1)' }}>{label}</span>
              <span className="font-semibold" style={{ color: 'rgb(76, 76, 76)' }}>{(val as number).toFixed(1)}°</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'rgba(76, 76, 76, 1)' }}>{!dims ? 'Select a sensor to calculate FOV.' : 'Enter a valid EFL to calculate.'}</p>
      )}
    </div>
  );
}

const formatValue = (value: string | number | undefined | null, unit: string = '') => {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  return `${value}${unit}`;
};

export function SupplierProductDetails({ lens, open, onOpenChange }: ProductDetailsProps) {
  const [showFov, setShowFov] = useState(false);
  if (!lens || !open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" style={backdropStyle} onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden flex" style={glassStyle}>

          {/* FOV Calculator panel */}
          {showFov && (
            <div className="w-64 shrink-0 overflow-y-auto p-6" style={{ borderRight: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: 'rgb(76, 76, 76)' }}>FOV Calculator</p>
              <FovCalculator lensEfl={lens.efl} />
            </div>
          )}

          {/* Specs */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold break-words" style={{ color: 'rgb(76, 76, 76)' }}>{lens.name}</h2>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {lens.supplier && <Badge style={{ background: 'rgba(255, 255, 255, 0.49)', color: 'rgb(76, 76, 76)', border: '1px solid rgba(255,255,255,0.25)' }}>{lens.supplier}</Badge>}
                  {lens.countryOfOrigin && <Badge style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(76, 76, 76,1)', border: '1px solid rgba(255,255,255,0.2)' }}>{lens.countryOfOrigin}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <Button size="sm" onClick={() => setShowFov(v => !v)}
                  style={{ background: showFov ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.4)', border: showFov ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(134,134,134,0.4)', color: showFov ? 'rgba(59,130,246,1)' : 'rgba(76,76,76,1)' }}>
                  <Calculator className="h-3 w-3 mr-1" />FOV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} style={{ color: 'rgba(76, 76, 76, 1)' }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {divider}

            <div className="space-y-3 mt-3">
              <DetailItem label="Sensor Size" value={lens.sensorSize} />
              {divider}
              <DetailItem label="EFL" value={formatValue(lens.efl, ' mm')} />
              <DetailItem label="Max image circle" value={formatValue(lens.maxImageCircle, ' mm')} />
              <DetailItem label="F. No." value={formatValue(lens.fNo)} />
              <DetailItem label="Diagonal FOV" value={formatValue(lens.fovD, '°')} />
              <DetailItem label="Horizontal FOV" value={formatValue(lens.fovH, '°')} />
              <DetailItem label="Vertical FOV" value={formatValue(lens.fovV, '°')} />
              {divider}
              <DetailItem label="TTL" value={formatValue(lens.ttl, ' mm')} />
              <DetailItem label="Distortion" value={formatValue(lens.tvDistortion, '%')} />
              <DetailItem label="Relative illumination" value={formatValue(lens.relativeIllumination, '%')} />
              <DetailItem label="Chief ray angle" value={formatValue(lens.chiefRayAngle, '°')} />
              {divider}
              <DetailItem label="Mount type" value={lens.mountType} />
              <DetailItem label="Lens structure" value={lens.lensStructure} />
              {lens.price && <>{divider}<DetailItem label="Price" value={lens.price} /></>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center">
    <p className="text-sm" style={{ color: 'rgba(76, 76, 76,1)' }}>{label}</p>
    <p className="text-sm font-medium" style={{ color: 'rgb(76, 76, 76)' }}>{formatValue(value as string)}</p>
  </div>
);