'use client';
import { DashboardPage } from '@/app/components/dashboard-page';
import { LoginPage } from '@/app/components/login-page';
import { useFirebase } from '@/firebase';

export default function Home() {
  const { user, isUserLoading } = useFirebase();

  if (isUserLoading) {
    return <div className='min-h-screen flex items-center justify-center text-muted-foreground'>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <DashboardPage />;
}