'use client';
import { Input } from '@/components/ui/input';
import { Search, LogOut, ShieldCheck } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { InviteButton } from './invite-button';
import { Badge } from '@/components/ui/badge';
type AppHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  children?: React.ReactNode;
};
export function AppHeader({ searchQuery, onSearchChange, children }: AppHeaderProps) {
  const { auth, user } = useFirebase();
  const { isAdmin } = useIsAdmin();
  const handleSignOut = () => signOut(auth);
  return (
    <header className='sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6'>
      <div className='flex items-center gap-4'>
        <h1 className='text-lg font-semibold md:text-xl whitespace-nowrap'>Appleye Lens Database</h1>
        <Button asChild variant='outline' size='sm'><a href='/supplier-lenses'>Unified Supplier Lenses</a></Button>
      </div>
      <div className='flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4'>
        <form className='ml-auto flex-1 sm:flex-initial' onSubmit={e => e.preventDefault()}>
          <div className='relative'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input type='search' placeholder='Search products by name...' className='pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]' value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
          </div>
        </form>
        {isAdmin && <Badge variant='secondary' className='gap-1'><ShieldCheck className='h-3 w-3' />Admin</Badge>}
        <InviteButton />
        {children}
        <Button variant='ghost' size='sm' onClick={handleSignOut} title={'Sign out ' + (user?.email || '')}>
          <LogOut className='h-4 w-4' />
        </Button>
      </div>
    </header>
  );
}