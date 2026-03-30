'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Eye } from 'lucide-react';

function InviteForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const { firestore, auth } = useFirebase();
  const [status, setStatus] = useState<'checking'|'valid'|'invalid'|'success'>('checking');
  const [role, setRole] = useState<'viewer'|'admin'>('viewer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !firestore) { setStatus('invalid'); return; }
    const ref = doc(firestore, 'invites', token);
    getDoc(ref).then(snap => {
      if (!snap.exists()) { setStatus('invalid'); return; }
      const data = snap.data();
      if (data.used) { setStatus('invalid'); return; }
      if (data.expiresAt.toDate() < new Date()) { setStatus('invalid'); return; }
      setRole(data.role || 'viewer');
      setStatus('valid');
    }).catch(() => setStatus('invalid'));
  }, [token, firestore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !firestore || !auth) return;
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(firestore, 'users', cred.user.uid), { role, email, createdAt: new Date() });
      await updateDoc(doc(firestore, 'invites', token), { used: true, usedBy: email, usedAt: new Date() });
      setStatus('success');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered.');
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const roleInfo = {
    viewer: { label: 'Viewer', icon: Eye, perms: ['View all lenses', 'Search & filter', 'Compare lenses', 'View PDFs', 'Upload PDFs', 'Export to Excel'] },
    admin: { label: 'Admin', icon: ShieldCheck, perms: ['Everything viewers can do', 'Edit lens fields', 'Delete lenses', 'Invite users'] },
  };

  if (status === 'checking') return <div className='min-h-screen flex items-center justify-center text-muted-foreground'>Checking invite...</div>;

  if (status === 'invalid') return (
    <div className='min-h-screen flex items-center justify-center px-4'>
      <Card className='w-full max-w-sm text-center'>
        <CardHeader>
          <CardTitle>Invalid invite</CardTitle>
          <CardDescription>This invite link is invalid, expired, or has already been used.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  if (status === 'success') return (
    <div className='min-h-screen flex items-center justify-center px-4'>
      <Card className='w-full max-w-sm text-center'>
        <CardHeader>
          <CardTitle>Account created!</CardTitle>
          <CardDescription>You can now sign in to Appleye Lens Database.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className='w-full' onClick={() => window.location.href = '/'}>Go to app</Button>
        </CardContent>
      </Card>
    </div>
  );

  const info = roleInfo[role];
  const Icon = info.icon;

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl'>Create your account</CardTitle>
          <CardDescription>You've been invited to Appleye Lens Database</CardDescription>
          <div className='mt-3 rounded-lg border p-3 text-left'>
            <div className='flex items-center gap-2 mb-2'>
              <Icon className='h-4 w-4' />
              <Badge variant='secondary'>{info.label}</Badge>
            </div>
            <ul className='space-y-1'>
              {info.perms.map(p => (
                <li key={p} className='text-xs text-muted-foreground flex items-center gap-1'>
                  <span className='text-green-500'>✓</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-1'>
              <Label htmlFor='email'>Email</Label>
              <Input id='email' type='email' value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='password'>Password</Label>
              <Input id='password' type='password' value={password} onChange={e => setPassword(e.target.value)} required placeholder='Min. 6 characters' />
            </div>
            {error && <p className='text-sm text-destructive'>{error}</p>}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return <Suspense fallback={<div className='min-h-screen flex items-center justify-center'>Loading...</div>}><InviteForm /></Suspense>;
}