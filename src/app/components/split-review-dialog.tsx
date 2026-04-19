'use client';
import React, { useState } from 'react';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, X, Save, Check } from 'lucide-react';

type SplitReviewDialogProps = {
  stagingLens: Lens;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FIELDS: { key: keyof Lens; label: string; unit?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'sensorSize', label: 'Sensor Size' },
  { key: 'efl', label: 'EFL', unit: 'mm' },
  { key: 'maxImageCircle', label: 'Image Circle', unit: 'mm' },
  { key: 'fNo', label: 'F. No.' },
  { key: 'fovD', label: 'FOV Diagonal', unit: '°' },
  { key: 'fovH', label: 'FOV Horizontal', unit: '°' },
  { key: 'fovV', label: 'FOV Vertical', unit: '°' },
  { key: 'ttl', label: 'TTL', unit: 'mm' },
  { key: 'tvDistortion', label: 'Distortion', unit: '%' },
  { key: 'relativeIllumination', label: 'Rel. Illumination', unit: '%' },
  { key: 'chiefRayAngle', label: 'Chief Ray Angle', unit: '°' },
  { key: 'mountType', label: 'Mount Type' },
  { key: 'lensStructure', label: 'Lens Structure' },
];

const TEXT = 'rgba(76,76,76,1)';
const TEXT_MUTED = 'rgba(76,76,76,0.55)';
const inputStyle = { background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(134,134,134,0.35)', color: TEXT };

export function SplitReviewDialog({ stagingLens, open, onOpenChange }: SplitReviewDialogProps) {
  const rawStaged = (stagingLens as any).stagedLenses as any[];
  const [lenses, setLenses] = useState<Partial<Lens>[]>(() =>
    rawStaged.map((l, i) => ({ ...l, _tempId: `staged-${i}` }))
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Lens>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  if (!open) return null;

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx);
    setEditData({ ...lenses[idx] });
  };

  const handleEditSave = () => {
    if (editingIdx === null) return;
    setLenses(prev => prev.map((l, i) => i === editingIdx ? { ...editData } : l));
    setEditingIdx(null);
  };

  const handleDelete = (idx: number) => {
    setLenses(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (!firestore || lenses.length === 0) return;
    setIsConfirming(true);
    try {
      const col = collection(firestore, 'products');
      for (let i = 0; i < lenses.length; i++) {
        const l = lenses[i];
        const safeName = (l.name || 'lens').replace(/[^a-zA-Z0-9]/g, '_');
        const newId = stagingLens.id + '_sensor_' + i + '_' + safeName;
        const { _tempId, ...lensData } = l as any;
        await setDoc(doc(col, newId), {
          ...lensData,
          id: newId,
          pdfUrl: stagingLens.pdfUrl,
          sourcePath: stagingLens.sourcePath,
          extractionStatus: 'extracted',
          updatedAt: new Date(),
          createdAt: new Date(),
        });
      }
      // Delete staging doc
      await deleteDoc(doc(firestore, 'products', stagingLens.id));
      toast({ title: 'Split confirmed', description: `${lenses.length} lenses created.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Confirm failed', description: err.message });
    } finally {
      setIsConfirming(false);
    }
  };

  const backdropStyle = {
    background: 'rgba(100,100,100,0.55)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  } as React.CSSProperties;

  const glassStyle = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.85)',
    boxShadow: '0 2px 32px rgba(0,0,0,0.10)',
  } as React.CSSProperties;

  return (
    <>
      <div className="fixed inset-0 z-50" style={backdropStyle} onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col" style={glassStyle}>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(134,134,134,0.25)' }}>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: TEXT }}>Review multi-sensor split</h2>
              <p className="text-sm mt-0.5" style={{ color: TEXT_MUTED }}>
                AI detected {rawStaged.length} sensor variants in <span className="font-medium">{stagingLens.sourcePath?.split('/').pop()}</span>. Review and confirm to create {lenses.length} separate lens records.
              </p>
            </div>
            <button onClick={() => onOpenChange(false)} className="ml-4 shrink-0 p-1 rounded-lg hover:bg-black/5">
              <X className="h-4 w-4" style={{ color: TEXT_MUTED }} />
            </button>
          </div>

          {/* Edit mode */}
          {editingIdx !== null ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium" style={{ color: TEXT }}>Editing: {editData.name || `Lens ${editingIdx + 1}`}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingIdx(null)}>
                    <X className="h-3 w-3 mr-1" />Cancel
                  </Button>
                  <Button size="sm" onClick={handleEditSave} style={{ background: 'rgba(50,150,50,0.15)', border: '1px solid rgba(50,150,50,0.4)', color: 'rgb(30,120,30)' }}>
                    <Save className="h-3 w-3 mr-1" />Save
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs" style={{ color: TEXT_MUTED }}>{field.label}{field.unit ? ` (${field.unit})` : ''}</Label>
                    <Input
                      value={(editData[field.key] as string) ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="h-8 text-sm"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Review table */
            <div className="flex-1 overflow-auto p-6">
              {lenses.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: TEXT_MUTED }}>All lenses deleted. Close to cancel.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-medium w-6" style={{ color: TEXT_MUTED, borderBottom: '1px solid rgba(134,134,134,0.25)' }}>#</th>
                      {FIELDS.slice(0, 8).map(f => (
                        <th key={f.key} className="text-left p-2 text-xs font-medium" style={{ color: TEXT_MUTED, borderBottom: '1px solid rgba(134,134,134,0.25)' }}>
                          {f.label}
                        </th>
                      ))}
                      <th className="p-2 w-20" style={{ borderBottom: '1px solid rgba(134,134,134,0.25)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lenses.map((lens, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                        <td className="p-2 text-xs" style={{ color: TEXT_MUTED }}>{idx + 1}</td>
                        {FIELDS.slice(0, 8).map(f => (
                          <td key={f.key} className="p-2 text-xs" style={{ color: lens[f.key] ? TEXT : TEXT_MUTED }}>
                            {(lens[f.key] as string) || '—'}
                          </td>
                        ))}
                        <td className="p-2">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => handleEditStart(idx)} className="p-1 rounded hover:bg-black/5">
                              <Pencil className="h-3 w-3" style={{ color: TEXT_MUTED }} />
                            </button>
                            <button onClick={() => handleDelete(idx)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 className="h-3 w-3" style={{ color: 'rgb(200,50,50)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Footer */}
          {editingIdx === null && (
            <div className="flex items-center justify-between p-6 pt-4" style={{ borderTop: '1px solid rgba(134,134,134,0.25)' }}>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>{lenses.length} lens{lenses.length !== 1 ? 'es' : ''} will be created</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={lenses.length === 0 || isConfirming}
                  onClick={handleConfirm}
                  style={{ background: 'rgba(50,150,50,0.15)', border: '1px solid rgba(50,150,50,0.4)', color: 'rgb(30,120,30)' }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  {isConfirming ? 'Creating...' : `Confirm & create ${lenses.length} lenses`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
