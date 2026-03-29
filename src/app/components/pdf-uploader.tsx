'use client';

import React, { useState, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadCloud, File, X, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export function PdfUploader() {
  const { storage, user, isUserLoading, userError } = useFirebase();
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isOpDisabled = !!uploadTask || isUserLoading || !!userError;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if (selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setIsSuccess(false);
        } else {
            toast({
                variant: 'destructive',
                title: 'Invalid File Type',
                description: 'Please select a PDF file.',
            });
            clearFile(false);
        }
    }
  };
  
  const handleUpload = () => {
    if (!file) return;
    
    if (!storage || !user) {
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'Authentication is required to upload files.',
      });
      return;
    }
    
    const storageRef = ref(storage, `lens-pdfs/${file.name}`);
    const newUploadTask = uploadBytesResumable(storageRef, file);
    setUploadTask(newUploadTask);

    newUploadTask.on(
      'state_changed',
      (snapshot) => {
        const currentProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(currentProgress);
      },
      (error) => {
        if (error.code !== 'storage/canceled') {
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error.message,
            });
        }
        setUploadTask(null);
        setProgress(0);
      },
      () => {
        getDownloadURL(newUploadTask.snapshot.ref).then(() => {
          toast({
            title: 'Upload Successful',
            description: `${file.name} will be processed shortly.`,
          });
          setIsSuccess(true);
          setUploadTask(null);
          setTimeout(() => {
            setIsOpen(false);
          }, 2000);
        });
      }
    );
  };
  
  const triggerFileSelect = () => {
      fileInputRef.current?.click();
  };

  const clearFile = (cancelUpload: boolean) => {
      if (cancelUpload && uploadTask) {
          uploadTask.cancel();
      }
      setFile(null);
      setProgress(0);
      setIsSuccess(false);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };
  
  const onOpenChange = (open: boolean) => {
      if (!open) {
          clearFile(true);
      }
      setIsOpen(open);
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={isOpDisabled}>
            <UploadCloud />
            Upload PDF
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf"
        />
        <div className="grid gap-4">
            <div className="space-y-2">
                <h4 className="font-medium leading-none">Upload Datasheet</h4>
                <p className="text-sm text-muted-foreground">
                    Upload a lens datasheet PDF for AI extraction.
                </p>
            </div>
            {!file ? (
                <Button variant="outline" onClick={triggerFileSelect}>Select PDF</Button>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <p className="truncate" title={file.name}>{file.name}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFile(true)} disabled={!!uploadTask}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {uploadTask ? (
                         <Progress value={progress} />
                    ) : isSuccess ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                           <CheckCircle className="h-4 w-4" />
                           <span>Upload complete!</span>
                        </div>
                    ) : (
                        <Button onClick={handleUpload} className="w-full">
                            <UploadCloud className="mr-2 h-4 w-4"/>
                            Upload and Process
                        </Button>
                    )}
                </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
