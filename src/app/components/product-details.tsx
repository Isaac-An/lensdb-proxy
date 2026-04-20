'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Pencil, X, Save, Trash2, RefreshCw, Calculator, StickyNote, Check, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase';
import { LensComparison } from './lens-comparison';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { doc, setDoc, deleteDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ProductDetailsProps = {
  isAdmin?: boolean;
  lens: Lens | null;
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
  background: 'rgba(100,100,100,0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const;

const inputStyle = {
  background: 'white',
  border: '1px solid #d1d5db',
  color: TEXT,
};

const divider = <div style={{ height: '1px', background: 'rgb(134,134,134)', margin: '4px 0' }} />;

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
        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Sensor</Label>
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
          <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Custom size (mm)</Label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Width" value={customW} onChange={e => setCustomW(e.target.value)} className="h-8 text-xs" style={inputStyle} />
            <Input type="number" placeholder="Height" value={customH} onChange={e => setCustomH(e.target.value)} className="h-8 text-xs" style={inputStyle} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>EFL (mm)</Label>
        <Input type="number" placeholder={lensEfl ? `${lensEfl} (from lens)` : 'Enter EFL...'} value={eflOverride} onChange={e => setEflOverride(e.target.value)} className="h-8 text-xs" style={inputStyle} />
        {!eflOverride && lensEfl && <p className="text-xs" style={{ color: TEXT_MUTED }}>Using lens EFL: {lensEfl}mm</p>}
      </div>
      {results ? (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(249,250,251,1)', border: '1px solid #e5e7eb' }}>
          {[['Horizontal', results.horizontal], ['Vertical', results.vertical], ['Diagonal', results.diagonal]].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-xs">
              <span style={{ color: TEXT_MUTED }}>{label}</span>
              <span className="font-semibold" style={{ color: TEXT }}>{(val as number).toFixed(1)}°</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: TEXT_MUTED }}>{!dims ? 'Select a sensor to calculate FOV.' : 'Enter a valid EFL to calculate.'}</p>
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
  { key: 'tvDistortion', label: 'Distortion', unit: '%' },
  { key: 'relativeIllumination', label: 'Relative Illumination', unit: '%' },
  { key: 'chiefRayAngle', label: 'Chief Ray Angle', unit: '°' },
  { key: 'mountType', label: 'Mount Type' },
  { key: 'lensStructure', label: 'Lens Structure' },
  { key: 'price', label: 'Price' },
];

type Note = { id: string; text: string; timestamp: number };

export function ProductDetails({ lens, open, onOpenChange, isAdmin = false }: ProductDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Lens>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [showFov, setShowFov] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyLog, setHistoryLog] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  const [compareWith, setCompareWith] = useState<Lens | null>(null);
  const [similarBy, setSimilarBy] = useState<'sensor'|'efl'|'fov'|'imageCircle'>('sensor');
  const [allLensesPool, setAllLensesPool] = useState<Lens[]>([]);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (lens) setEditData({ ...lens });
    setIsEditing(false);
    setShowFov(false);
    setShowNotes(false);
    setShowHistory(false);
    setHistoryLog([]);
    setNotes([]);
    setNoteInput('');
    setShowSimilar(false);
  }, [lens]);

  useEffect(() => {
    if (!showSimilar || allLensesPool.length > 0 || !firestore) return;
    setIsLoadingPool(true);
    Promise.all([
      getDocs(collection(firestore, 'products')),
      getDocs(collection(firestore, 'supplier_lenses')),
    ]).then(([prodSnap, supSnap]) => {
      const all: Lens[] = [
        ...prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lens)),
        ...supSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lens)),
      ];
      setAllLensesPool(all);
    }).finally(() => setIsLoadingPool(false));
  }, [showSimilar, firestore]);

  useEffect(() => {
    if (!showNotes || !firestore || !lens?.id) return;
    setIsLoadingNotes(true);
    getDocs(collection(firestore, 'products', lens.id, 'notes'))
      .then(snap => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
        loaded.sort((a, b) => b.timestamp - a.timestamp);
        setNotes(loaded);
      })
      .finally(() => setIsLoadingNotes(false));
  }, [showNotes, lens?.id, firestore]);

  useEffect(() => {
    if (!showHistory || !firestore || !lens?.id) return;
    setIsLoadingHistory(true);
    getDocs(collection(firestore, 'products', lens.id, 'history'))
      .then(snap => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loaded.sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLog(loaded);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [showHistory, lens?.id, firestore]);

  const handleAddNote = async () => {
    if (!noteInput.trim() || !firestore || !lens?.id) return;
    setIsSavingNote(true);
    try {
      const ref = await addDoc(
        collection(firestore, 'products', lens.id, 'notes'),
        { text: noteInput.trim(), timestamp: Date.now(), createdAt: serverTimestamp() }
      );
      setNotes(prev => [{ id: ref.id, text: noteInput.trim(), timestamp: Date.now() }, ...prev]);
      setNoteInput('');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!firestore || !lens?.id) return;
    const { doc: fsDoc, deleteDoc: fsDeleteDoc } = await import('firebase/firestore');
    await fsDeleteDoc(fsDoc(firestore, 'products', lens.id, 'notes', noteId));
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editingNoteText.trim() || !firestore || !lens?.id) return;
    const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
    await updateDoc(fsDoc(firestore, 'products', lens.id, 'notes', noteId), { text: editingNoteText.trim() });
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text: editingNoteText.trim() } : n));
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const similarLenses = useMemo(() => {
    if (!lens || allLensesPool.length === 0) return [];
    const pool = allLensesPool.filter(l => l.id !== lens.id);
    if (similarBy === 'sensor') {
      if (!lens.sensorSize) return [];
      return pool.filter(l => l.sensorSize === lens.sensorSize).slice(0, 5);
    }
    if (similarBy === 'efl') {
      const efl = parseFloat(lens.efl || '');
      if (isNaN(efl)) return [];
      return pool.filter(l => {
        const v = parseFloat(l.efl || '');
        return !isNaN(v) && Math.abs(v - efl) / efl <= 0.2;
      }).sort((a,b) => Math.abs(parseFloat(a.efl||'0')-efl) - Math.abs(parseFloat(b.efl||'0')-efl)).slice(0, 5);
    }
    if (similarBy === 'fov') {
      const fov = parseFloat(lens.fovD || '');
      if (isNaN(fov)) return [];
      return pool.filter(l => {
        const v = parseFloat(l.fovD || '');
        return !isNaN(v) && Math.abs(v - fov) <= 15;
      }).sort((a,b) => Math.abs(parseFloat(a.fovD||'0')-fov) - Math.abs(parseFloat(b.fovD||'0')-fov)).slice(0, 5);
    }
    if (similarBy === 'imageCircle') {
      const ic = parseFloat(lens.maxImageCircle || '');
      if (isNaN(ic)) return [];
      return pool.filter(l => {
        const v = parseFloat(l.maxImageCircle || '');
        return !isNaN(v) && Math.abs(v - ic) <= 1;
      }).sort((a,b) => Math.abs(parseFloat(a.maxImageCircle||'0')-ic) - Math.abs(parseFloat(b.maxImageCircle||'0')-ic)).slice(0, 5);
    }
    return [];
  }, [lens, allLensesPool, similarBy]);

  if (!lens || !open) return null;

  const hasPdfUrl = lens.pdfUrl && lens.pdfUrl.startsWith('https://');
  const isFromPdf = !!lens.sourcePath;
  const sidePanelOpen = showFov || showNotes || showHistory;

  const btnStyle = { background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(134,134,134,0.4)', color: TEXT };
  const btnActiveStyle = { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.5)', color: 'rgba(59,130,246,1)' };

  const handleSave = async () => {
    if (!firestore || !lens.id) return;
    setIsSaving(true);
    try {
      // Compute changed fields
      const changes: { field: string; from: string; to: string }[] = [];
      editableFields.forEach(f => {
        const oldVal = String(lens[f.key] ?? '').trim();
        const newVal = String((editData[f.key] as string) ?? '').trim();
        if (oldVal !== newVal) changes.push({ field: f.label, from: oldVal || '—', to: newVal || '—' });
      });

      await setDoc(doc(firestore, 'products', lens.id), { ...editData, updatedAt: new Date() }, { merge: true });

      // Write history entry if there were changes
      if (changes.length > 0) {
        const { getAuth } = await import('firebase/auth');
        const user = getAuth().currentUser;
        await addDoc(collection(firestore, 'products', lens.id, 'history'), {
          changes,
          editedBy: user?.email || 'unknown',
          timestamp: Date.now(),
          createdAt: serverTimestamp(),
        });
      }

      toast({ title: 'Saved', description: 'Lens updated successfully.' });
      setIsEditing(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => { setEditData({ ...lens }); setIsEditing(false); };

  const handleReExtract = async () => {
    if (!lens.pdfUrl || !lens.sourcePath) return;
    setIsReExtracting(true);
    try {
      const response = await fetch(lens.pdfUrl);
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const { getStorage, ref, uploadBytes } = await import('firebase/storage');
      const storage = getStorage();
      const storageRef = ref(storage, lens.sourcePath);
      await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
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
    } finally { setIsDeleting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50" style={backdropStyle} onClick={() => !isEditing && onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto relative w-full max-h-[90vh] rounded-3xl overflow-hidden flex transition-all duration-300"
          style={{ ...glassStyle, maxWidth: sidePanelOpen ? '56rem' : '42rem' }}
        >

          {/* FOV Calculator panel */}
          {showFov && (
            <div className="w-64 shrink-0 overflow-y-auto p-6" style={{ borderRight: '1px solid #e5e7eb', background: 'rgba(249,250,251,0.8)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: TEXT }}>FOV Calculator</p>
              <FovCalculator lensEfl={lens.efl} />
            </div>
          )}

          {/* Notes panel */}
          {showNotes && (
            <div className="w-64 shrink-0 overflow-y-auto p-6 flex flex-col gap-3" style={{ borderRight: '1px solid #e5e7eb', background: 'rgba(249,250,251,0.8)' }}>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Notes</p>
              <div className="flex flex-col gap-2">
                <textarea
                  placeholder="Add a note..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddNote())}
                  rows={3}
                  className="w-full rounded-md text-xs p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                  style={inputStyle}
                />
                <Button size="sm" onClick={handleAddNote} disabled={isSavingNote || !noteInput.trim()} className="self-end" style={btnStyle}>
                  {isSavingNote ? '...' : 'Add note'}
                </Button>
              </div>
              {isLoadingNotes ? (
                <p className="text-xs" style={{ color: TEXT_MUTED }}>Loading...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs" style={{ color: TEXT_MUTED }}>No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="group rounded-lg p-2" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                      {editingNoteId === n.id ? (
                        <div className="flex flex-col gap-1">
                          <textarea
                            value={editingNoteText}
                            onChange={e => setEditingNoteText(e.target.value)}
                            rows={3}
                            className="w-full rounded text-xs p-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                            style={inputStyle}
                            autoFocus
                          />
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }} className="p-1 rounded hover:bg-gray-100">
                              <X className="h-3 w-3" style={{ color: 'rgba(134,134,134,1)' }} />
                            </button>
                            <button onClick={() => handleSaveEdit(n.id)} className="p-1 rounded hover:bg-gray-100">
                              <Check className="h-3 w-3" style={{ color: 'rgb(30,120,30)' }} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs flex-1" style={{ color: TEXT }}>{n.text}</p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }} className="p-0.5 rounded hover:bg-gray-100">
                                <Pencil className="h-3 w-3" style={{ color: 'rgba(134,134,134,1)' }} />
                              </button>
                              <button onClick={() => handleDeleteNote(n.id)} className="p-0.5 rounded hover:bg-red-50">
                                <Trash2 className="h-3 w-3" style={{ color: 'rgba(200,50,50,0.8)' }} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'rgba(134,134,134,1)' }}>{new Date(n.timestamp).toLocaleString()}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History panel */}
          {showHistory && (
            <div className="w-64 shrink-0 overflow-y-auto p-6 flex flex-col gap-3" style={{ borderRight: '1px solid #e5e7eb', background: 'rgba(249,250,251,0.8)' }}>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Edit History</p>
              {isLoadingHistory ? (
                <p className="text-xs" style={{ color: TEXT_MUTED }}>Loading...</p>
              ) : historyLog.length === 0 ? (
                <p className="text-xs" style={{ color: TEXT_MUTED }}>No edits recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {historyLog.map((entry: any) => (
                    <div key={entry.id} className="rounded-lg p-2" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: TEXT }}>{entry.editedBy}</p>
                      <div className="space-y-1">
                        {entry.changes?.map((c: any, i: number) => (
                          <div key={i} className="text-xs" style={{ color: TEXT_MUTED }}>
                            <span className="font-medium">{c.field}:</span>{' '}
                            <span style={{ color: 'rgba(200,50,50,0.8)' }}>{c.from}</span>
                            {' → '}
                            <span style={{ color: 'rgb(30,120,30)' }}>{c.to}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'rgba(134,134,134,1)' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold truncate" style={{ color: TEXT }}>{lens.name}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <Button size="sm" onClick={() => { setShowFov(v => !v); setShowNotes(false); setShowHistory(false); }} style={showFov ? btnActiveStyle : btnStyle}>
                  <Calculator className="h-3 w-3 mr-1" />FOV
                </Button>
                <Button size="sm" onClick={() => { setShowNotes(v => !v); setShowFov(false); setShowHistory(false); }} style={showNotes ? btnActiveStyle : btnStyle}>
                  <StickyNote className="h-3 w-3 mr-1" />Notes
                  {notes.length > 0 && (
                    <span className="ml-1 rounded-full px-1 text-xs" style={{ background: 'rgba(59,130,246,0.2)', color: 'rgba(59,130,246,1)' }}>{notes.length}</span>
                  )}
                </Button>
                <Button size="sm" onClick={() => { setShowHistory(v => !v); setShowFov(false); setShowNotes(false); }} style={showHistory ? btnActiveStyle : btnStyle}>
                  <History className="h-3 w-3 mr-1" />History
                </Button>
                {!isEditing ? (
                  <>
                    {isAdmin && <Button size="sm" onClick={() => setIsEditing(true)} style={btnStyle}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" style={{ background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(200,50,50,0.3)', color: 'rgb(180,50,50)' }}><Trash2 className="h-3 w-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {lens.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove this lens. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} style={{ color: TEXT_MUTED }}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={handleCancel} disabled={isSaving} style={btnStyle}><X className="h-3 w-3 mr-1" />Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} style={{ background: 'rgba(50,150,50,0.2)', border: '1px solid rgba(50,150,50,0.4)', color: 'rgb(30,120,30)' }}><Save className="h-3 w-3 mr-1" />{isSaving ? 'Saving...' : 'Save'}</Button>
                  </>
                )}
              </div>
            </div>

            {divider}

            <div className="space-y-3 mt-3">
              {editableFields.map((field, i) => (
                <div key={field.key}>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Label className="text-sm" style={{ color: TEXT_MUTED }}>{field.label}{field.unit ? ` (${field.unit})` : ''}</Label>
                      <Input value={(editData[field.key] as string) ?? ''} onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))} className="h-8 text-sm" style={inputStyle} />
                    </div>
                  ) : (
                    <DetailItem label={field.label} value={formatValue(lens[field.key] as string, field.unit ? ` ${field.unit}` : '')} />
                  )}
                  {[2, 6, 10, 12].includes(i) && !isEditing && divider}
                </div>
              ))}
            </div>

            {divider}

            {isFromPdf && (
              <div className="space-y-2 my-3">
                <p className="text-sm" style={{ color: TEXT_MUTED }}>AI Extraction Status</p>
                {lens.extractionStatus === 'extracted' && <Badge style={{ background: 'rgba(50,150,50,0.15)', color: 'rgb(30,120,30)', border: '1px solid rgba(50,150,50,0.3)' }}>Extracted Successfully</Badge>}
                {lens.extractionStatus === 'failed' && (
                  <div>
                    <Badge style={{ background: 'rgba(200,50,50,0.15)', color: 'rgb(180,50,50)', border: '1px solid rgba(200,50,50,0.3)' }}>Extraction Failed</Badge>
                    {lens.debug_error && <div className="mt-2 rounded-md p-3 text-xs font-mono" style={{ background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.2)', color: 'rgb(180,50,50)' }}>{lens.debug_error}</div>}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center mb-3">
              <p className="text-sm" style={{ color: TEXT_MUTED }}>PDF Document</p>
              {hasPdfUrl ? (
                <Button asChild size="sm" style={btnStyle}>
                  <a href={lens.pdfUrl!} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />View</a>
                </Button>
              ) : <p className="text-sm" style={{ color: TEXT_MUTED }}>Not Available</p>}
            </div>

            {isAdmin && lens.sourcePath && (
              <div className="flex justify-between items-center">
                <p className="text-sm" style={{ color: TEXT_MUTED }}>AI Extraction</p>
                <Button size="sm" onClick={handleReExtract} disabled={isReExtracting} style={btnStyle}>
                  <RefreshCw className={"h-3 w-3 mr-1 " + (isReExtracting ? "animate-spin" : "")} />
                  {isReExtracting ? "Re-extracting..." : "Re-extract"}
                </Button>
              </div>
            )}

            {divider}

            <div>
              <button className="flex items-center justify-between w-full text-left py-2" onClick={() => setShowSimilar(v => !v)}>
                <p className="text-sm font-medium" style={{ color: TEXT }}>Similar lenses</p>
                <span className="text-xs" style={{ color: TEXT_MUTED }}>{showSimilar ? '▲' : '▼'}</span>
              </button>
              {showSimilar && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {(['sensor','efl','fov','imageCircle'] as const).map(opt => (
                      <button key={opt} onClick={() => setSimilarBy(opt)} className="px-2 py-0.5 rounded-full text-xs border transition-colors"
                        style={similarBy === opt
                          ? { background: 'rgba(76,76,76,0.15)', border: '1px solid rgba(76,76,76,0.4)', color: TEXT }
                          : { background: 'transparent', border: '1px solid rgba(134,134,134,0.3)', color: TEXT_MUTED }
                        }>
                        {opt === 'sensor' ? 'Sensor' : opt === 'efl' ? 'EFL ±20%' : opt === 'fov' ? 'FOV ±15°' : 'Image Circle ±1mm'}
                      </button>
                    ))}
                  </div>
                  {isLoadingPool ? (
                    <p className="text-xs" style={{ color: TEXT_MUTED }}>Loading...</p>
                  ) : similarLenses.length === 0 ? (
                    <p className="text-xs" style={{ color: TEXT_MUTED }}>No similar lenses found.</p>
                  ) : (
                    <div className="space-y-1">
                      {similarLenses.map(sl => (
                        <button key={sl.id} onClick={() => setCompareWith(sl)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors hover:bg-black/5"
                          style={{ border: '1px solid rgba(134,134,134,0.2)' }}>
                          <span className="text-xs font-medium line-clamp-1" style={{ color: TEXT }}>{sl.name}</span>
                          <span className="text-xs ml-2 shrink-0" style={{ color: TEXT_MUTED }}>
                            {similarBy === 'sensor' ? sl.sensorSize : similarBy === 'efl' ? (sl.efl ? sl.efl + 'mm' : '—') : similarBy === 'fov' ? (sl.fovD ? sl.fovD + '°' : '—') : (sl.maxImageCircle ? sl.maxImageCircle + 'mm' : '—')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {compareWith && lens && (
        <LensComparison lenses={[lens, compareWith]} open={true} onOpenChange={(o) => { if (!o) setCompareWith(null); }} />
      )}
    </>
  );
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center">
    <p className="text-sm" style={{ color: TEXT_MUTED }}>{label}</p>
    <p className="text-sm font-medium" style={{ color: TEXT }}>{value}</p>
  </div>
);