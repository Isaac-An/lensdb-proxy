'use client';
import React, { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { AlertTriangle, RefreshCw, X, Bot, GitFork, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FailedLens = {
  id: string;
  name?: string;
  extractionStatus: string;
  debug_error?: string;
  sourcePath?: string;
};

type SplitLens = {
  id: string;
  name?: string;
  sourcePath?: string;
  stagedLenses?: any[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onReviewSplit?: (lensId: string) => void;
};

export function ErrorDashboard({ open, onClose, onReviewSplit }: Props) {
  const { firestore } = useFirebase();
  const { isSuperAdmin } = useIsAdmin();
  const [failedLenses, setFailedLenses] = useState<FailedLens[]>([]);
  const [splitLenses, setSplitLenses] = useState<SplitLens[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'failed' | 'split'>('failed');

  const load = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const [failedSnap, splitSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'products'), where('extractionStatus', '==', 'failed'), limit(50))),
        getDocs(query(collection(firestore, 'products'), where('extractionStatus', '==', 'needs_split_review'), limit(50))),
      ]);
      setFailedLenses(failedSnap.docs.map(d => ({ id: d.id, ...d.data() } as FailedLens)));
      setSplitLenses(splitSnap.docs.map(d => ({ id: d.id, ...d.data() } as SplitLens)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isSuperAdmin) load();
  }, [open, isSuperAdmin]);

  if (!open || !isSuperAdmin) return null;

  const totalIssues = failedLenses.length + splitLenses.length;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
          style={{ background: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5" style={{ color: 'rgba(76,76,76,0.7)' }} />
              <h2 className="text-lg font-semibold">AI Dashboard</h2>
              {totalIssues > 0 && <Badge variant="destructive">{totalIssues} issue{totalIssues !== 1 ? 's' : ''}</Badge>}
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

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTab('failed')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === 'failed' ? 'rgb(239,68,68)' : 'transparent',
                color: tab === 'failed' ? 'rgb(239,68,68)' : 'rgba(76,76,76,0.6)',
              }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Extraction Failed
              {failedLenses.length > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)' }}>
                  {failedLenses.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('split')}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === 'split' ? 'rgb(59,130,246)' : 'transparent',
                color: tab === 'split' ? 'rgb(59,130,246)' : 'rgba(76,76,76,0.6)',
              }}
            >
              <GitFork className="h-3.5 w-3.5" />
              Pending Split Review
              {splitLenses.length > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}>
                  {splitLenses.length}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : tab === 'failed' ? (
              failedLenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-sm text-muted-foreground">No extraction errors.</p>
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
                          {lens.sourcePath && <p className="text-xs text-red-600 mt-0.5 truncate">{lens.sourcePath}</p>}
                          {lens.debug_error && (
                            <p className="text-xs font-mono mt-2 p-2 rounded bg-red-100 text-red-800 break-all">{lens.debug_error}</p>
                          )}
                        </div>
                        <Badge variant="destructive" className="shrink-0 text-xs">Failed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              splitLenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-sm text-muted-foreground">No pending split reviews.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {splitLenses.map(lens => (
                    <div key={lens.id} className="rounded-xl p-4 border border-blue-100 bg-blue-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-blue-900 truncate">{lens.name || lens.id}</p>
                          {lens.sourcePath && <p className="text-xs text-blue-600 mt-0.5 truncate">{lens.sourcePath}</p>}
                          {lens.stagedLenses && (
                            <p className="text-xs text-blue-700 mt-1">{lens.stagedLenses.length} sensor variants detected</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: 'rgb(59,130,246)', border: '1px solid rgba(59,130,246,0.3)' }}>
                            Needs Review
                          </Badge>
                          {onReviewSplit && (
                            <Button
                              size="sm"
                              onClick={() => { onReviewSplit(lens.id); onClose(); }}
                              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: 'rgb(37,99,235)' }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
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
    Promise.all([
      getDocs(query(collection(firestore, 'products'), where('extractionStatus', '==', 'failed'), limit(50))),
      getDocs(query(collection(firestore, 'products'), where('extractionStatus', '==', 'needs_split_review'), limit(50))),
    ]).then(([f, s]) => setCount(f.size + s.size)).catch(() => {});
  }, [firestore, isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        border: count > 0 ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(134,134,134,0.25)',
        color: count > 0 ? 'rgb(161,122,0)' : 'rgba(76,76,76,0.6)',
        background: count > 0 ? 'rgba(234,179,8,0.08)' : 'transparent',
      }}
    >
      <Bot className="h-3.5 w-3.5" />
      AI Dashboard{count > 0 ? ` · ${count}` : ''}
    </button>
  );
}