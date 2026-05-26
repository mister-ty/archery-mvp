'use client';

import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ObservationForm } from './ObservationForm';

type Tag = { id: string; name: string };

type Observation = {
  id: string;
  content: string;
  createdAt: Date;
  editableUntil: Date;
  coachName: string;
  coachId: string;
  coachUserId: string;
  tags: Tag[];
  sessionId: string;
};

type Props = {
  observations: Observation[];
  allTags: Tag[];
  currentUserId: string | null;
};

export function ObservationList({ observations, allTags, currentUserId }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  if (!observations.length) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Sin observaciones aún"
        description="El coach puede registrar feedback técnico que quedará vinculado a esta sesión."
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {observations.map((obs) => {
        const isEditable =
          obs.coachUserId === currentUserId && new Date() < new Date(obs.editableUntil);

        return (
          <div
            key={obs.id}
            className="rounded-xl border bg-card p-4 shadow-sm space-y-3 transition hover:border-primary/30"
          >
            {editing === obs.id ? (
              <ObservationForm
                sessionId={obs.sessionId}
                allTags={allTags}
                initial={{ id: obs.id, content: obs.content, tagIds: obs.tags.map((t) => t.id) }}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start gap-3">
                <Avatar name={obs.coachName} size="sm" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm leading-relaxed">{obs.content}</p>
                    {obs.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {obs.tags.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">{obs.coachName}</span>
                        {' · '}
                        {new Date(obs.createdAt).toLocaleDateString('es-CO')}
                      </span>
                      {isEditable && (
                        <button
                          onClick={() => setEditing(obs.id)}
                          className="text-xs font-medium text-primary transition hover:text-primary-hover"
                        >
                          Editar
                        </button>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
