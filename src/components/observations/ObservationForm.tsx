'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createObservation, updateObservation } from '@/server/actions/observations';

type Tag = { id: string; name: string };

type Props = {
  sessionId: string;
  allTags: Tag[];
  initial?: {
    id: string;
    content: string;
    tagIds: string[];
  };
  onDone?: () => void;
};

export function ObservationForm({ sessionId, allTags, initial, onDone }: Props) {
  const [content, setContent] = useState(initial?.content ?? '');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(initial?.tagIds ?? [])
  );
  const [pending, startTransition] = useTransition();

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      const tagIds = [...selectedTags];
      const result = initial
        ? await updateObservation({ id: initial.id, content, tagIds })
        : await createObservation({ sessionId, content, tagIds });

      if (result.ok) {
        toast.success(initial ? 'Observación actualizada' : 'Observación guardada');
        if (!initial) {
          setContent('');
          setSelectedTags(new Set());
        }
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Observación técnica del coach..."
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        maxLength={2000}
      />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`rounded-full px-2.5 py-0.5 text-xs border transition ${
                selectedTags.has(tag.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !content.trim()}
        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 transition"
      >
        {pending ? 'Guardando…' : initial ? 'Actualizar' : 'Guardar observación'}
      </button>
    </form>
  );
}
