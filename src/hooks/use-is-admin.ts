'use client';
import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { firestore, user } = useFirebase();

  useEffect(() => {
    if (!user || !firestore) { setIsAdmin(false); setIsLoading(false); return; }
    const ref = doc(firestore, 'users', user.uid);
    getDoc(ref).then(snap => {
      setIsAdmin(snap.exists() && snap.data()?.role === 'admin');
    }).catch(() => setIsAdmin(false))
    .finally(() => setIsLoading(false));
  }, [user, firestore]);

  return { isAdmin, isLoading };
}