/* eslint-disable no-console */
/**
 * Inserta datos de demo para poder verificar F5–F8.
 * Idempotente: busca antes de crear.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/test-data.ts
 */
import { PrismaClient, Role, SessionType, DominantHand } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log('🎯 Inserting test data…\n');

  // Get the club created by seed
  const club = await db.club.findFirst({ where: { name: 'Club Demo' } });
  if (!club) {
    console.error('Club Demo not found — run npm run db:seed first');
    process.exit(1);
  }

  // Get master data
  const recurve = await db.bowModality.findUnique({ where: { code: 'RECURVE' } });
  const compound = await db.bowModality.findUnique({ where: { code: 'COMPOUND' } });
  const seniorCat = await db.category.findUnique({ where: { code: 'SENIOR' } });
  const juniorCat = await db.category.findUnique({ where: { code: 'JUNIOR' } });

  if (!recurve || !compound || !seniorCat || !juniorCat) {
    console.error('Master data missing — run npm run db:seed first');
    process.exit(1);
  }

  // ── Coach ──────────────────────────────────────────────────────────────────
  let coachUser = await db.user.findUnique({ where: { email: 'coach@archery.local' } });
  if (!coachUser) {
    coachUser = await db.user.create({
      data: {
        email: 'coach@archery.local',
        passwordHash: await bcrypt.hash('Coach123!', 12),
        role: Role.COACH,
        clubId: club.id
      }
    });
    console.log('✓ Coach user created');
  }

  let coach = await db.coach.findUnique({ where: { userId: coachUser.id } });
  if (!coach) {
    coach = await db.coach.create({
      data: { userId: coachUser.id, clubId: club.id, firstName: 'Carlos', lastName: 'Mendoza' }
    });
    console.log('✓ Coach profile created');
  }

  // ── Athletes ──────────────────────────────────────────────────────────────
  async function ensureAthlete(
    email: string,
    first: string,
    last: string,
    docId: string,
    bowId: string,
    catId: string
  ) {
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash('Athlete123!', 12),
          role: Role.ATHLETE,
          clubId: club!.id
        }
      });
    }
    let athlete = await db.athlete.findUnique({ where: { documentId: docId } });
    if (!athlete) {
      athlete = await db.athlete.create({
        data: {
          userId: user.id,
          clubId: club!.id,
          coachId: coach!.id,
          bowModalityId: bowId,
          categoryId: catId,
          firstName: first,
          lastName: last,
          documentId: docId,
          birthDate: new Date('1998-05-15'),
          dominantHand: DominantHand.RIGHT
        }
      });
      console.log(`✓ Athlete ${first} ${last} created`);
    }
    return athlete;
  }

  const athlete1 = await ensureAthlete(
    'sofia@archery.local', 'Sofía', 'Ramírez', 'COL001', recurve.id, seniorCat.id
  );
  const athlete2 = await ensureAthlete(
    'juan@archery.local', 'Juan', 'Torres', 'COL002', compound.id, juniorCat.id
  );

  // ── Sessions + Scores ─────────────────────────────────────────────────────
  async function ensureSession(
    athleteId: string,
    daysBack: number,
    distances: number[],
    indoor: boolean,
    type: SessionType
  ) {
    const date = daysAgo(daysBack);
    const existing = await db.trainingSession.findFirst({
      where: { athleteId, date: { gte: new Date(date.getTime() - 60000), lte: new Date(date.getTime() + 60000) } }
    });
    if (existing) return existing;

    const ts = await db.trainingSession.create({
      data: {
        athleteId,
        date,
        type,
        indoor,
        createdById: coachUser!.id,
        scoreSets: {
          create: distances.map((distance) => ({
            distance,
            endsCount: indoor ? 10 : 6,
            arrowsPerEnd: indoor ? 3 : 6
          }))
        }
      },
      include: { scoreSets: true }
    });

    // Fill arrows with realistic scores (slight improvement trend)
    for (const ss of ts.scoreSets) {
      const base = indoor ? 7 : 6;
      const improvement = Math.max(0, (60 - daysBack) / 60);
      const arrows = [];
      for (let end = 1; end <= ss.endsCount; end++) {
        for (let arrow = 1; arrow <= ss.arrowsPerEnd; arrow++) {
          const score = Math.min(10, Math.max(0, base + Math.round(improvement * 2) + rnd(-2, 2)));
          arrows.push({
            scoreSetId: ss.id,
            endNumber: end,
            arrowNumber: arrow,
            score,
            isX: score === 10 && Math.random() > 0.7,
            isMiss: false
          });
        }
      }
      await db.arrow.createMany({ data: arrows });
    }

    return ts;
  }

  // Sofía — 8 sesiones en los últimos 60 días
  const s1 = await ensureSession(athlete1.id, 55, [18], true, SessionType.TECHNICAL);
  const s2 = await ensureSession(athlete1.id, 48, [18], true, SessionType.SERIES);
  const s3 = await ensureSession(athlete1.id, 41, [18, 30], false, SessionType.SERIES);
  const s4 = await ensureSession(athlete1.id, 34, [30], false, SessionType.COMPETITION_SIM);
  const s5 = await ensureSession(athlete1.id, 27, [18], true, SessionType.TECHNICAL);
  const s6 = await ensureSession(athlete1.id, 20, [18, 30], false, SessionType.SERIES);
  const s7 = await ensureSession(athlete1.id, 13, [30, 50], false, SessionType.SERIES);
  const s8 = await ensureSession(athlete1.id, 5, [18], true, SessionType.TECHNICAL);

  // Juan — 5 sesiones, última hace 16 días (inactivo → alerta)
  await ensureSession(athlete2.id, 50, [18], true, SessionType.SERIES);
  await ensureSession(athlete2.id, 40, [18], true, SessionType.TECHNICAL);
  await ensureSession(athlete2.id, 30, [50, 70], false, SessionType.SERIES);
  await ensureSession(athlete2.id, 22, [50], false, SessionType.COMPETITION_SIM);
  await ensureSession(athlete2.id, 16, [50, 70], false, SessionType.SERIES);

  console.log('✓ Sessions created');

  // ── Attendance ────────────────────────────────────────────────────────────
  const sessions = [s1, s2, s3, s4, s5, s6, s7, s8];
  for (const ts of sessions) {
    const existing = await db.attendance.findUnique({ where: { sessionId: ts.id } });
    if (!existing) {
      await db.attendance.create({
        data: { sessionId: ts.id, athleteId: athlete1.id, status: 'PRESENT' }
      });
    }
  }
  console.log('✓ Attendance recorded');

  // ── Observations ──────────────────────────────────────────────────────────
  const anchorTag = await db.observationTag.findUnique({ where: { code: 'ANCHOR' } });
  const postureTag = await db.observationTag.findUnique({ where: { code: 'POSTURE' } });
  const releaseTag = await db.observationTag.findUnique({ where: { code: 'RELEASE' } });

  const existingObs = await db.coachObservation.findFirst({ where: { sessionId: s7.id } });
  if (!existingObs) {
    await db.coachObservation.create({
      data: {
        sessionId: s7.id,
        coachId: coach.id,
        content: 'Buena progresión en la suelta. Trabajar anclaje en los últimos ends — tendencia a subir la mano de cuerda en condiciones de viento. Repetir el ejercicio de cierre de escápula.',
        editableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tags: { connect: [anchorTag, releaseTag].filter(Boolean).map((t) => ({ id: t!.id })) }
      }
    });

    await db.coachObservation.create({
      data: {
        sessionId: s5.id,
        coachId: coach.id,
        content: 'Postura sólida durante toda la sesión indoor. Se nota la mejora en la posición de los hombros respecto a la semana pasada. Continuar con el trabajo de estabilización de cadera.',
        editableUntil: new Date(Date.now() - 60 * 1000), // already expired
        tags: { connect: [postureTag].filter(Boolean).map((t) => ({ id: t!.id })) }
      }
    });
    console.log('✓ Observations created');
  }

  console.log('\n✅ Test data ready!');
  console.log('   Coach login:   coach@archery.local / Coach123!');
  console.log('   Athlete login: sofia@archery.local / Athlete123!');
  console.log('   Athlete 2:     juan@archery.local  / Athlete123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
