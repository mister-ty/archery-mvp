import { notFound } from 'next/navigation';
import { getSessionForScoring } from '@/server/actions/sessions';
import ScoreCapture from '@/components/scoring/ScoreCapture';

export default async function ScoringPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { distance?: string };
}) {
  const session = await getSessionForScoring(params.id);
  if (!session) notFound();

  if (session.scoreSets.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Esta sesión no tiene distancias configuradas.
        </p>
      </div>
    );
  }

  // Pick the distance: from query, else first incomplete, else first.
  const wanted = searchParams.distance ? Number(searchParams.distance) : null;
  const target =
    (wanted &&
      session.scoreSets.find((s) => s.distance === wanted)) ||
    session.scoreSets.find(
      (s) => s.arrows.length < s.endsCount * s.arrowsPerEnd
    ) ||
    session.scoreSets[0];

  const athleteName = `${session.athlete.firstName} ${session.athlete.lastName}`;

  return (
    <div className="mx-auto max-w-md">
      {session.scoreSets.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {session.scoreSets.map((s) => (
            <a
              key={s.id}
              href={`?distance=${s.distance}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                s.distance === target.distance
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {s.distance}m
            </a>
          ))}
        </div>
      )}

      <ScoreCapture
        athleteName={athleteName}
        scoreSet={{
          id: target.id,
          sessionId: session.id,
          distance: target.distance,
          endsCount: target.endsCount,
          arrowsPerEnd: target.arrowsPerEnd,
          arrows: target.arrows.map((a) => ({
            endNumber: a.endNumber,
            arrowNumber: a.arrowNumber,
            score: a.score,
            isX: a.isX,
            isMiss: a.isMiss
          }))
        }}
      />
    </div>
  );
}
