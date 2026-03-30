'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { getIdToken } from 'firebase/auth';
import { Progress } from '@/components/ui/progress';

const BUCKET = 'studio-3861763439-b3374.firebasestorage.app';

export function PdfUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { auth } = useFirebase();
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !auth) return;

    const pdfs = files.filter(f => f.name.endsWith('.pdf'));
    if (!pdfs.length) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select PDF files only.' });
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const token = await getIdToken(auth.currentUser!);
      let completed = 0;

      for (const file of pdfs) {
        const encodedPath = encodeURIComponent(`lens-pdfs/${file.name}`);
        const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodedPath}&uploadType=media`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
            'Authorization': `Firebase ${token}`,
          },
          body: file,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error?.message || 'Upload failed');
        }

        completed++;
        setProgress(Math.round((completed / pdfs.length) * 100));
      }

      toast({
        title: 'Upload complete',
        description: `${pdfs.length} PDF(s) uploaded. AI extraction is running — lenses will appear shortly.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
        <Upload className="mr-2 h-4 w-4" />
        {isUploading ? `Uploading... ${progress}%` : 'Upload PDF'}
      </Button>
      {isUploading && <Progress value={progress} className="w-32" />}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf"
        multiple
      />
    </>
  );
}
