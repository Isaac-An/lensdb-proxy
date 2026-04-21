'use client';
import React, { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { useIsAdmin } from '@/hooks/use-is-admin';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ErrorEntry = {
  id: string;
  type: 'extraction_failed' | 'sync_error' | 'other';
  message: string;
  lensName?: string;
  sourcePath?: string;
  timestamp: number;
  resolved?: boolean;
};

type FailedLens = {
  id: string;
  name: string;
  extractionStatus: string;
  debug_error?: string;
  sourcePath?: string;
  updatedAt?: any;
};

export function ErrorDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firestore } = useFirebase();
  const { isSuperAdmin } = useIsAdmin();
  const [failedLenses, setFailedLenses] = useState<FailedLens[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'products'),
        where('extractionStatus', '==', 'failed'),
        limit(50)
      ));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as FailedLens));
      setFailedLenses(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isSuperAdmin) load();
  }, [open, isSuperAdmin]);

  if (!open || !isSuperAdmin) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
          style={{ background: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold">Error Dashboard</h2>
              {failedLenses.length > 0 && (
                <Badge variant="destructive">{failedLenses.length} failed</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : failedLenses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm text-muted-foreground">No extraction errors found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  {failedLenses.length} lens{failedLenses.length !== 1 ? 'es' : ''} failed AI extraction.
                </p>
                {failedLenses.map(lens => (
                  <div key={lens.id} className="rounded-xl p-4 border border-red-100 bg-red-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-red-900 truncate">{lens.name || lens.id}</p>
                        {lens.sourcePath && (
                          <p className="text-xs text-red-600 mt-0.5 truncate">{lens.sourcePath}</p>
                        )}
                        {lens.debug_error && (
                          <p className="text-xs font-mono mt-2 p-2 rounded bg-red-100 text-red-800 break-all">
                            {lens.debug_error}
                          </p>
                        )}
                      </div>
                      <Badge variant="destructive" className="shrink-0 text-xs">Failed</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function ErrorDashboardBadge({ onClick }: { onClick: () => void }) {
  const { firestore } = useFirebase();
  const { isSuperAdmin } = useIsAdmin();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!firestore || !isSuperAdmin) return;
    getDocs(query(
      collection(firestore, 'products'),
      where('extractionStatus', '==', 'failed'),
      limit(50)
    )).then(snap => setCount(snap.size)).catch(() => {});
  }, [firestore, isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-red-50"
      style={{ border: '1px solid rgba(200,50,50,0.3)', color: 'rgb(180,50,50)', background: 'rgba(255,80,80,0.08)' }}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {count > 0 ? `${count} error${count !== 1 ? 's' : ''}` : 'Errors'}
    </button>
  );
}
