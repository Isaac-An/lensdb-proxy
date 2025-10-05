'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type AiInsightsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insights: string;
};

export function AiInsightsDialog({ open, onOpenChange, insights }: AiInsightsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>AI-Generated Product Insights</AlertDialogTitle>
          <AlertDialogDescription className="text-left whitespace-pre-wrap">
            {insights}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
