'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Pencil, X, Save, Trash2, RefreshCw, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProductDetailsProps = {
  isAdmin?: boolean;
  lens: Lens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SENSOR_PRESETS: Record<string, { w: number; h: number; d: number }> = {
  'Full Frame (36x24mm)':   { w: 36,    h: 24,   d: 43.27 },
  'APS-C (23.5x15.6mm)':   { w: 23.5,  h: 15.6, d: 28.21 },
  '1" (12.8x9.6mm)':       { w: 12.8,  h: 9.6,  d: 16.0  },
  '1/1.2" (10.67x8mm)':    { w: 10.67, h: 8,    d: 13.33 },
  '1/1.8" (7.18x5.32mm)':  { w: 7.18,  h: 5.32, d: 8.93  },
  '1/2" (6.4x4.8mm)':      { w: 6.4,   h: 4.8,  d: 8.0   },
  '1/2.3" (6.16x4.62mm)':  { w: 6.16,  h: 4.62, d: 7.70  },
  '1/2.5" (5.76x4.29mm)':  { w: 5.76,  h: 4.29, d: 7.18  },
  '1/3" (4.8x3.6mm)':      { w: 4.8,   h: 3.6,  d: 6.0   },
  '1/3.6" (4x3mm)':        { w: 4,     h: 3,    d: 5.0   },
  '1/4" (3.2x2.4mm)':      { w: 3.2,   h: 2.4,  d: 4.0   },
  '1/4.5" (2.84x2.13mm)':  { w: 2.84,  h: 2.13, d: 3.55  },
  '1/6" (2.4x1.8mm)':      { w: 2.4,   h: 1.8,  d: 3.0   },
  'IMX185 (1/2.8")':        { w: 5.6,   h: 3.2,  d: 6.46  },
  'IMX265 (1/1.8")':        { w: 7.18,  h: 5.32, d: 8.93  },
  'IMX273 (1/2.9")':        { w: 5.37,  h: 4.04, d: 6.71  },
  'IMX290 (1/2.8")':        { w: 5.6,   h: 3.2,  d: 6.46  },
  'IMX296 (1/2.9")':        { w: 5.37,  h: 4.04, d: 6.71  },
  'IMX297 (1/4.5")':        { w: 2.84,  h: 2.13, d: 3.55  },
  'IMX327 (1/2.8")':        { w: 5.6,   h: 3.2,  d: 6.46  },
  'IMX335 (1/2.8")':        { w: 5.6,   h: 3.2,  d: 6.46  },
  'IMX415 (1/2.8")':        { w: 5.6,   h: 3.2,  d: 6.46  },
  'IMX464 (1/1.8")':        { w: 7.18,  h: 5.32, d: 8.93  },
  'IMX485 (1/1.2")':        { w: 10.67, h: 8,    d: 13.33 },
  'OV2311 (1/2.9")':        { w: 5.37,  h: 4.04, d: 6.71  },
  'OV4689 (1/3")':          { w: 4.8,   h: 3.6,  d: 6.0   },
  'OV7251 (1/7.5")':        { w: 2.0,   h: 1.5,  d: 2.5   },
  'AR0234 (1/2.6")':        { w: 5.86,  h: 3.28, d: 6.73  },
};

function calcFov(sensorDim: number, efl: number): number {
  return 2 * (180 / Math.PI) * Math.atan(sensorDim / (2 * efl));
}

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

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sensor</Label>
        <Select value={sensorPreset} onValueChange={v => { setSensorPreset(v); setCustomW(''); setCustomH(''); }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select sensor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            {Object.keys(SENSOR_PRESETS).map(k => (
              <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(!sensorPreset || sensorPreset === 'custom') && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom size (mm)</Label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Width" value={customW} onChange={e => setCustomW(e.target.value)} className="h-8 text-xs" />
            <Input type="number" placeholder="Height" value={customH} onChange={e => setCustomH(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">EFL (mm)</Label>
        <Input
          type="number"
          placeholder={lensEfl ? `${lensEfl} (from lens)` : 'Enter EFL...'}
          value={eflOverride}
          onChange={e => setEflOverride(e.target.value)}
          className="h-8 text-xs"
        />
        {!eflOverride && lensEfl && (
          <p className="text-xs text-muted-foreground">Using lens EFL: {lensEfl}mm</p>
        )}
      </div>

      {results ? (
        <div className="rounded-md bg-muted p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Horizontal</span>
            <span className="font-semibold">{results.horizontal.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Vertical</span>
            <span className="font-semibold">{results.vertical.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Diagonal</span>
            <span className="font-semibold">{results.diagonal.toFixed(1)}°</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {!dims ? 'Select a sensor to calculate FOV.' : 'Enter a valid EFL to calculate.'}
        </p>
      )}
    </div>
  );
}

const formatValue = (value: string | number | undefined | null, unit: string = '') => {
  if (value === null || value === undefined || String(value).trim() === '') return 'N/A';
  return `${value}${unit}`;
};

const editableFields: { key: keyof Lens; label: string; unit?: string }[] = [
  { key: 'sensorSize', label: 'Sensor Size' },
  { key: 'efl', label: 'EFL', unit: 'mm' },
  { key: 'maxImageCircle', label: 'Max Image Circle', unit: 'mm' },
  { key: 'fNo', label: 'F. No.' },
  { key: 'fovD', label: 'Diagonal FOV', unit: '°' },
  { key: 'fovH', label: 'Horizontal FOV', unit: '°' },
  { key: 'fovV', label: 'Vertical FOV', unit: '°' },
  { key: 'ttl', label: 'TTL', unit: 'mm' },
  { key: 'tvDistortion', label: 'TV Distortion', unit: '%' },
  { key: 'relativeIllumination', label: 'Relative Illumination', unit: '%' },
  { key: 'chiefRayAngle', label: 'Chief Ray Angle', unit: '°' },
  { key: 'mountType', label: 'Mount Type' },
  { key: 'lensStructure', label: 'Lens Structure' },
  { key: 'price', label: 'Price' },
];

export function ProductDetails({ lens, open, onOpenChange, isAdmin = false }: ProductDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Lens>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [showFov, setShowFov] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (lens) setEditData({ ...lens });
    setIsEditing(false);
    setShowFov(false);
  }, [lens]);

  if (!lens) return null;

  const hasPdfUrl = lens.pdfUrl && lens.pdfUrl.startsWith('https://');
  const isFromPdf = !!lens.sourcePath;

  const handleSave = async () => {
    if (!firestore || !lens.id) return;
    setIsSaving(true);
    try {
      const docRef = doc(firestore, 'products', lens.id);
      await setDoc(docRef, { ...editData, updatedAt: new Date() }, { merge: true });
      toast({ title: 'Saved', description: 'Lens updated successfully.' });
      setIsEditing(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({ ...lens });
    setIsEditing(false);
  };

  const handleReExtract = async () => {
    if (!lens.pdfUrl || !lens.sourcePath) return;
    setIsReExtracting(true);
    try {
      const { getIdToken } = await import('firebase/auth');
      const { getAuth } = await import('firebase/auth');
      const currentAuth = getAuth();
      const token = await getIdToken(currentAuth.currentUser!);
      const response = await fetch(lens.pdfUrl);
      const blob = await response.blob();
      const BUCKET = 'studio-3861763439-b3374.firebasestorage.app';
      const encodedPath = encodeURIComponent(lens.sourcePath);
      const uploadUrl = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o?name=' + encodedPath + '&uploadType=media';
      await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'Authorization': 'Firebase ' + token },
        body: blob,
      });
      toast({ title: 'Re-extraction started', description: 'The lens data will update shortly.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Re-extraction failed', description: err.message });
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !lens.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'products', lens.id));
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="overflow-y-auto transition-all duration-300"
        style={{ width: showFov ? '860px' : '480px', maxWidth: '95vw' }}
      >
        <div className={showFov ? 'flex gap-6 h-full' : ''}>
  {/* Left: FOV Calculator panel */}
  {showFov && (
    <div className="w-64 shrink-0 border-r pr-6 pt-2 overflow-y-auto">
      <p className="text-sm font-semibold mb-4">FOV Calculator</p>
      <FovCalculator lensEfl={lens.efl} />
    </div>
  )}
  {/* Right: Specs */}
  <div className={showFov ? 'flex-1 min-w-0 overflow-y-auto' : ''}>
            <SheetHeader className="text-left">
              <div className="flex items-start justify-between pr-8">
                <div>
                  <SheetTitle className="text-2xl">{lens.name}</SheetTitle>
                  <SheetDescription>Detailed specifications for {lens.name}.</SheetDescription>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button
                    variant={showFov ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFov(v => !v)}
                    title="FOV Calculator"
                  >
                    <Calculator className="h-3 w-3 mr-1" />
                    FOV
                  </Button>
                  {!isEditing ? (
                    <>
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-3 w-3 mr-1" />Edit
                      </Button>}
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {lens.name}?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this lens. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                {isDeleting ? 'Deleting...' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                        <X className="h-3 w-3 mr-1" />Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-3 w-3 mr-1" />{isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="py-6 space-y-4">
              {editableFields.map((field, i) => (
                <div key={field.key}>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">
                        {field.label}{field.unit ? ` (${field.unit})` : ''}
                      </Label>
                      <Input
                        value={(editData[field.key] as string) ?? ''}
                        onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  ) : (
                    <DetailItem
                      label={field.label}
                      value={formatValue(lens[field.key] as string, field.unit ? ` ${field.unit}` : '')}
                    />
                  )}
                  {[2, 6, 10, 12].includes(i) && !isEditing && <Separator className="mt-4" />}
                </div>
              ))}

              <Separator />

              {isFromPdf && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">AI Extraction Status</p>
                  {lens.extractionStatus === 'extracted' && <Badge variant="secondary">Extracted Successfully</Badge>}
                  {lens.extractionStatus === 'failed' && (
                    <div>
                      <Badge variant="destructive">Extraction Failed</Badge>
                      {lens.debug_error && (
                        <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                          <p className="font-mono whitespace-pre-wrap">{lens.debug_error}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {lens.extractionStatus !== 'extracted' && lens.extractionStatus !== 'failed' && (
                    <p className="text-sm text-muted-foreground">Processing...</p>
                  )}
                </div>
              )}

              {isFromPdf && <Separator />}

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">PDF Document</p>
                {hasPdfUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={lens.pdfUrl!} target="_blank" rel="noopener noreferrer">
                      <FileText className="mr-2 h-4 w-4" />View
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Not Available</p>
                )}
              </div>

              {isAdmin && lens.sourcePath && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">AI Extraction</p>
                  <Button variant="outline" size="sm" onClick={handleReExtract} disabled={isReExtracting}>
                    <RefreshCw className={"h-3 w-3 mr-1 " + (isReExtracting ? "animate-spin" : "")} />
                    {isReExtracting ? "Re-extracting..." : "Re-extract"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          
        </div>
      </SheetContent>
    </Sheet>
  );
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);