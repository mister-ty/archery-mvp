'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { revokeInvitation } from '@/server/actions/invitations';

type Props = { invitationId: string; email: string };

export function RevokeInviteButton({ invitationId, email }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm(`¿Revocar invitación de ${email}?`)) return;
    startTransition(async () => {
      const result = await revokeInvitation(invitationId);
      if (result.ok) {
        toast.success('Invitación revocada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition disabled:opacity-50"
      aria-label={`Revocar invitación de ${email}`}
    >
      <Trash2 className="h-3 w-3" />
      Revocar
    </button>
  );
}
