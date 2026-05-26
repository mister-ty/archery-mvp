/* eslint-disable no-console */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const BOW_MODALITIES = [
  { code: 'RECURVE', name: 'Recurvo' },
  { code: 'COMPOUND', name: 'Compuesto' },
  { code: 'BAREBOW', name: 'Arco desnudo' },
  { code: 'LONGBOW', name: 'Longbow' },
  { code: 'TRADITIONAL', name: 'Tradicional' }
];

// Categorías estándar World Archery (simplificadas para MVP)
const CATEGORIES = [
  { code: 'U14', name: 'Menores (U14)', minAge: null, maxAge: 13 },
  { code: 'CADET', name: 'Cadete', minAge: 14, maxAge: 17 },
  { code: 'JUNIOR', name: 'Juvenil', minAge: 18, maxAge: 20 },
  { code: 'SENIOR', name: 'Mayor', minAge: 21, maxAge: 49 },
  { code: 'MASTER', name: 'Máster', minAge: 50, maxAge: null }
];

const OBSERVATION_TAGS = [
  { code: 'POSTURE', name: 'Postura' },
  { code: 'ANCHOR', name: 'Anclaje' },
  { code: 'RELEASE', name: 'Suelta' },
  { code: 'AIMING', name: 'Puntería' },
  { code: 'BREATHING', name: 'Respiración' },
  { code: 'CADENCE', name: 'Cadencia' },
  { code: 'MENTAL', name: 'Mental' },
  { code: 'EQUIPMENT', name: 'Material' }
];

async function seedMasterTables() {
  console.log('→ Seeding bow modalities...');
  for (const m of BOW_MODALITIES) {
    await db.bowModality.upsert({
      where: { code: m.code },
      update: { name: m.name, active: true },
      create: m
    });
  }

  console.log('→ Seeding categories...');
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { code: c.code },
      update: { name: c.name, minAge: c.minAge, maxAge: c.maxAge, active: true },
      create: c
    });
  }

  console.log('→ Seeding observation tags...');
  for (const t of OBSERVATION_TAGS) {
    await db.observationTag.upsert({
      where: { code: t.code },
      update: { name: t.name },
      create: t
    });
  }
}

async function seedAdminAndClub() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const clubName = process.env.SEED_CLUB_NAME ?? 'Club Demo';

  if (!adminEmail || !adminPassword) {
    console.log('⚠ Skipping admin seed: SEED_ADMIN_EMAIL/PASSWORD not set.');
    return;
  }

  console.log(`→ Ensuring club "${clubName}"...`);
  // Clubs no tienen unique natural; usamos findFirst + create para idempotencia.
  let club = await db.club.findFirst({ where: { name: clubName } });
  if (!club) {
    club = await db.club.create({ data: { name: clubName } });
  }

  console.log(`→ Ensuring super admin "${adminEmail}"...`);
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db.user.upsert({
    where: { email: adminEmail },
    update: {
      // No sobreescribimos el password en re-runs por seguridad.
      role: Role.SUPER_ADMIN,
      active: true,
      clubId: club.id
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.SUPER_ADMIN,
      active: true,
      clubId: club.id
    }
  });
}

async function main() {
  console.log('🎯 Archery MVP — Running seeds (idempotent)\n');
  await seedMasterTables();
  await seedAdminAndClub();
  console.log('\n✓ Seeds completed successfully.');
}

main()
  .catch((e) => {
    console.error('✗ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
