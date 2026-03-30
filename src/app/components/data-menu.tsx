'use client';
import React, { useRef, useState } from 'react';
import type { Lens } from '@/app/lib/types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Upload, FileInput, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { getIdToken } from 'firebase/auth';
import * as XLSX from 'xlsx';
const BUCKET = 'studio-3861763439-b3374.firebasestorage.app';
type DataMenuProps = { onAppend: (lenses: Lens[]) => void; onReplace: (lenses: Lens[]) => void; isDisabled: boolean; allLenses: Lens[]; };
type DuplicateFile = { file: File; existingLens: Lens | null };
const allLensKeys: (keyof Lens)[] = ['id','name','sensorSize','efl','maxImageCircle','fNo','fovD','fovH','fovV','ttl','tvDistortion','relativeIllumination','chiefRayAngle','mountType','lensStructure','price','pdfUrl'];
export function DataMenu({ onAppend, onReplace, isDisabled, allLenses }: DataMenuProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [currentDuplicate, setCurrentDuplicate] = useState<DuplicateFile | null>(null);
  const { auth } = useFirebase();
  const { toast } = useToast();
  const checkExists = async (filename: string, token: string): Promise<boolean> => {
    const encodedPath = encodeURIComponent('lens-pdfs/' + filename);
    const url = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodedPath;
    const res = await fetch(url, { headers: { 'Authorization': 'Firebase ' + token } });
    return res.ok;
  };
  const uploadFile = async (file: File, token: string) => {
    const encodedPath = encodeURIComponent('lens-pdfs/' + file.name);
    const url = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o?name=' + encodedPath + '&uploadType=media';
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'Authorization': 'Firebase ' + token }, body: file });
    if (response.ok) return;
    const err = await response.json();
    throw new Error(err?.error?.message || 'Upload failed');
  };
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !auth) return;
    const pdfs = files.filter(f => f.name.endsWith('.pdf'));
    if (pdfs.length === 0) return;
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    setIsUploading(true);
    try {
      const token = await getIdToken(auth.currentUser!);
      const toUpload: File[] = [];
      const dupes: DuplicateFile[] = [];
      for (const file of pdfs) {
        const exists = await checkExists(file.name, token);
        if (exists) {
          const safeId = ('lens-pdfs/' + file.name).replace(/[^a-zA-Z0-9]/g, '_');
          const existingLens = allLenses.find(l => l.sourcePath === 'lens-pdfs/' + file.name || l.id === safeId) || null;
          dupes.push({ file, existingLens });
        } else { toUpload.push(file); }
      }
      let uploaded = 0;
      for (const file of toUpload) { await uploadFile(file, token); uploaded++; }
      if (uploaded > 0) toast({ title: 'Upload complete', description: uploaded + ' PDF(s) uploaded. AI extraction is running.' });
      if (dupes.length > 0) { setDuplicates(dupes); setCurrentDuplicate(dupes[0]); }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally { setIsUploading(false); }
  };
  const handleDuplicateDecision = async (reupload: boolean) => {
    if (!currentDuplicate || !auth) return;
    if (reupload) {
      try {
        const token = await getIdToken(auth.currentUser!);
        await uploadFile(currentDuplicate.file, token);
        toast({ title: 'Re-uploaded', description: currentDuplicate.file.name + ' will be re-extracted.' });
      } catch (err: any) { toast({ variant: 'destructive', title: 'Upload failed', description: err.message }); }
    }
    const remaining = duplicates.filter(d => d.file.name !== currentDuplicate.file.name);
    setDuplicates(remaining);
    setCurrentDuplicate(remaining.length > 0 ? remaining[0] : null);
  };
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file == null) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length < 2) { toast({ variant: 'destructive', title: 'Empty file' }); return; }
        const headerRow = json[0];
        const norm = (h: string) => typeof h === 'string' ? h.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const headers = headerRow.map(norm);
        const keyMap: { [k: string]: keyof Lens } = { productname:'name',name:'name',sensorsize:'sensorSize',eflmm:'efl',efl:'efl',maximagecirclemm:'maxImageCircle',maximagecircle:'maxImageCircle',fno:'fNo',fovdiagonal:'fovD',fovd:'fovD',fovhorizontal:'fovH',fovh:'fovH',fovvertical:'fovV',fovv:'fovV',ttlmm:'ttl',ttl:'ttl',tvdistortion:'tvDistortion',relativeillumination:'relativeIllumination',chiefrayangle:'chiefRayAngle',mounttype:'mountType',mount:'mountType',lensstructure:'lensStructure',price:'price',pdfurl:'pdfUrl',pdf:'pdfUrl' };
        const imported = json.slice(1).map((row: any[], i) => {
          const d: Partial<Lens> = { id: 'imported-' + Date.now() + '-' + i };
          headers.forEach((h, ci) => { const k = keyMap[h]; if (k) (d as any)[k] = row[ci] == null ? '' : String(row[ci]); });
          for (const p of allLensKeys) { if (!(p in d)) (d as any)[p] = ''; }
          return d as Lens;
        }).filter(l => l.name && l.name.trim() !== '');
        if (imported.length === 0) { toast({ variant: 'destructive', title: 'No valid lenses found' }); return; }
        onAppend(imported);
        toast({ title: 'Import complete', description: imported.length + ' lenses imported.' });
      } catch (err: any) { toast({ variant: 'destructive', title: 'Import failed', description: err.message }); }
      finally { if (excelInputRef.current) excelInputRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };
  const handleExport = () => {
    if (allLenses.length === 0) { toast({ variant: 'destructive', title: 'No lenses to export' }); return; }
    const rows = allLenses.map(l => ({ 'Name':l.name,'Sensor Size':l.sensorSize,'EFL (mm)':l.efl,'Max Image Circle (mm)':l.maxImageCircle,'F. No.':l.fNo,'FOV Diagonal':l.fovD,'FOV Horizontal':l.fovH,'FOV Vertical':l.fovV,'TTL (mm)':l.ttl,'TV Distortion (%)':l.tvDistortion,'Relative Illumination (%)':l.relativeIllumination,'Chief Ray Angle':l.chiefRayAngle,'Mount Type':l.mountType,'Lens Structure':l.lensStructure,'Price':l.price,'PDF URL':l.pdfUrl }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lenses');
    XLSX.writeFile(wb, 'appleye-lenses-' + new Date().toISOString().slice(0,10) + '.xlsx');
    toast({ title: 'Export complete', description: allLenses.length + ' lenses exported.' });
  };
  const existing = currentDuplicate?.existingLens;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size='sm' disabled={isDisabled || isUploading}><Plus className='h-4 w-4 mr-1' />{isUploading ? 'Checking...' : 'Data'}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          <DropdownMenuLabel>Import</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => pdfInputRef.current?.click()}><Upload className='h-4 w-4 mr-2' />Upload PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={() => excelInputRef.current?.click()}><FileInput className='h-4 w-4 mr-2' />Import CSV / Excel</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleExport}><Download className='h-4 w-4 mr-2' />Export to Excel</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={pdfInputRef} type='file' accept='.pdf' multiple className='hidden' onChange={handlePdfUpload} />
      <input ref={excelInputRef} type='file' accept='.xlsx,.xls,.csv' className='hidden' onChange={handleExcelImport} />
      {currentDuplicate && (
        <AlertDialog open={true} onOpenChange={() => handleDuplicateDecision(false)}>
          <AlertDialogContent className='max-w-2xl'>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate PDF detected</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className='space-y-3'>
                  <p><strong>{currentDuplicate.file.name}</strong> already exists. Re-uploading will overwrite and re-extract all fields.</p>
                  {existing && (
                    <div className='rounded-md border overflow-hidden'>
                      <div className='bg-muted px-3 py-2 text-xs font-medium text-muted-foreground'>Current data in database</div>
                      <table className='w-full text-sm'>
                        <tbody>
                          {[
                            ['Name', existing.name],
                            ['Sensor size', existing.sensorSize],
                            ['EFL', existing.efl ? existing.efl + ' mm' : null],
                            ['Max image circle', existing.maxImageCircle ? existing.maxImageCircle + ' mm' : null],
                            ['F. No.', existing.fNo],
                            ['FOV diagonal', existing.fovD ? existing.fovD + '°' : null],
                            ['TTL', existing.ttl ? existing.ttl + ' mm' : null],
                            ['TV distortion', existing.tvDistortion ? existing.tvDistortion + '%' : null],
                            ['Mount type', existing.mountType],
                            ['Lens structure', existing.lensStructure],
                            ['Extraction status', existing.extractionStatus],
                          ].filter(([,v]) => v).map(([label, value], i) => (
                            <tr key={label as string} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                              <td className='px-3 py-1.5 text-muted-foreground w-40'>{label}</td>
                              <td className='px-3 py-1.5 font-medium'>{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {duplicates.length > 1 && <p className='text-xs text-muted-foreground'>{duplicates.length - 1} more duplicate(s) after this.</p>}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleDuplicateDecision(false)}>Skip</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDuplicateDecision(true)}>Re-upload & re-extract</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}