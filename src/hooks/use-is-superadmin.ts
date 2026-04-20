'use client';
import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useIsSuperAdmin() {
  const { firestore, user } = useFirebase();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !firestore) { setIsSuperAdmin(false); setLoading(false); return; }
    getDoc(doc(firestore, 'users', user.uid))
      .then(snap => {
        setIsSuperAdmin(snap.data()?.role === 'superadmin');
      })
      .catch(() => setIsSuperAdmin(false))
      .finally(() => setLoading(false));
  }, [user, firestore]);

  return { isSuperAdmin, loading };
}
