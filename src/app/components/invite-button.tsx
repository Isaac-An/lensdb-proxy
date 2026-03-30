'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useFirebase } from '@/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { UserPlus, Copy, Check, ShieldCheck, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Badge } from '@/components/ui/badge';

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

const roles = {
  viewer: {
    label: 'Viewer',
    icon: Eye,
    description: 'Can search, filter, compare and view all lens specs and PDFs. Cannot edit or delete.',
    permissions: ['View all lenses', 'Search & filter', 'Compare lenses', 'View PDFs', 'Upload PDFs', 'Export to Excel'],
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    description: 'Full access including editing lens data, deleting lenses, and inviting new users.',
    permissions: ['Everything viewers can do', 'Edit lens fields', 'Delete lenses', 'Invite users'],
  },
};

export function InviteButton() {
  const { firestore } = useFirebase();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'viewer'|'admin'>('viewer');
  const [generated, setGenerated] = useState(false);

  if (!isAdmin) return null;

  const handleOpen = () => { setGenerated(false); setLink(''); setSelectedRole('viewer'); setOpen(true); };

  const handleGenerate = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await setDoc(doc(firestore, 'invites', token), {
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt),
        role: selectedRole,
        used: false,
      });
      const url = window.location.origin + '/invite?token=' + token;
      setLink(url);
      setGenerated(true);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to generate invite', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant='outline' size='sm' onClick={handleOpen}>
        <UserPlus className='h-4 w-4 mr-1' />
        Invite
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>Choose a role then generate a 7-day invite link.</DialogDescription>
          </DialogHeader>
          {!generated ? (
            <div className='space-y-4 mt-2'>
              <div className='grid grid-cols-2 gap-3'>
                {(Object.entries(roles) as [string, typeof roles.viewer][]).map(([key, role]) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === key;
                  return (
                    <button key={key} onClick={() => setSelectedRole(key as 'viewer'|'admin')}
                      className={'rounded-lg border-2 p-3 text-left transition-all ' + (isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
                      <div className='flex items-center gap-2 mb-2'>
                        <Icon className='h-4 w-4' />
                        <span className='font-medium text-sm'>{role.label}</span>
                      </div>
                      <p className='text-xs text-muted-foreground mb-2'>{role.description}</p>
                      <ul className='space-y-1'>
                        {role.permissions.map(p => (
                          <li key={p} className='text-xs flex items-center gap-1'>
                            <span className='text-green-500'>✓</span> {p}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              <Button className='w-full' onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating...' : 'Generate invite link'}
              </Button>
            </div>
          ) : (
            <div className='space-y-3 mt-2'>
              <div className='flex items-center gap-2'>
                <Badge variant='secondary'>{roles[selectedRole].label}</Badge>
                <span className='text-sm text-muted-foreground'>invite link — expires in 7 days</span>
              </div>
              <div className='flex items-center gap-2'>
                <code className='flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all'>{link}</code>
                <Button size='sm' variant='outline' onClick={handleCopy}>
                  {copied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
                </Button>
              </div>
              <Button variant='outline' className='w-full' onClick={() => setGenerated(false)}>
                Generate another link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}