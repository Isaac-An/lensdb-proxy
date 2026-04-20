'use client';
import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean; isSuperAdmin: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { firestore, user } = useFirebase();

  useEffect(() => {
    if (!user || !firestore) { setIsAdmin(false); setIsSuperAdmin(false); setIsLoading(false); return; }
    const ref = doc(firestore, 'users', user.uid);
    getDoc(ref).then(snap => {
      const role = snap.data()?.role;
      setIsSuperAdmin(role === 'superadmin');
      setIsAdmin(role === 'admin' || role === 'superadmin');
    }).catch(() => { setIsAdmin(false); setIsSuperAdmin(false); })
    .finally(() => setIsLoading(false));
  }, [user, firestore]);

  return { isAdmin, isLoading, isSuperAdmin };
}