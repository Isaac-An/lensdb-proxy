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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Pencil, X, Save, Trash2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type ProductDetailsProps = {
  isAdmin?: boolean;
  lens: Lens | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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
  const { firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    if (lens) setEditData({ ...lens });
    setIsEditing(false);
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
      const { auth: firebaseAuth } = await import('firebase/auth');
      const { getIdToken } = firebaseAuth;
      const { auth } = await import('@/firebase').then(m => ({ auth: m.useFirebase }));
      // Re-fetch the PDF from storage and re-upload to trigger the function
      const response = await fetch(lens.pdfUrl);
      const blob = await response.blob();
      const BUCKET = 'studio-3861763439-b3374.firebasestorage.app';
      const encodedPath = encodeURIComponent(lens.sourcePath);
      // We need auth token - use firestore workaround via current user
      const { getAuth } = await import('firebase/auth');
      const currentAuth = getAuth();
      const token = await getIdToken(currentAuth.currentUser!);
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
      <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between pr-8">
            <div>
              <SheetTitle className="text-2xl">{lens.name}</SheetTitle>
              <SheetDescription>Detailed specifications for {lens.name}.</SheetDescription>
            </div>
            {!isEditing ? (
              <div className="flex gap-2">
                {isAdmin && <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
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
                        <AlertDialogDescription>
                          This will permanently remove this lens from the database. This cannot be undone.
                        </AlertDialogDescription>
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
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
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
              {lens.extractionStatus === 'extracted' && (
                <Badge variant="secondary">Extracted Successfully</Badge>
              )}
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
                <a href={lens.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  View
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
