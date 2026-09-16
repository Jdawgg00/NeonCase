import { PrismaClient, type Rarity } from '@prisma/client'
import { skinSeeds } from './seed-data/skins'
import { caseSeeds } from './seed-data/cases'
import { buildDropWeights } from '../server/utils/case-odds'

const prisma = new PrismaClient()

const STARTING_BALANCE = Number(process.env.STARTING_BALANCE ?? 10_000)


async function seedSkinsAndCases() {
  const skinBySlug = new Map<string, { id: string; rarity: Rarity }>()

  for (const s of skinSeeds) {
    const created = await prisma.skinDefinition.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    })
    skinBySlug.set(s.slug, { id: created.id, rarity: created.rarity })
  }

  for (const c of caseSeeds) {
    // casePrice/keyPrice are seed-only defaults: the seed script runs on every
    // boot (no separate release step on Minato), so an update clause here
    // would silently clobber a live Steam price refresh on every redeploy.
    // Only a brand-new case gets the seed price; an existing one keeps
    // whatever price it already has.
    const caseDefinition = await prisma.caseDefinition.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
      },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        casePrice: c.casePrice,
        keyPrice: c.keyPrice,
        status: 'ACTIVE',
      },
    })

    const existingVersion = await prisma.caseVersion.findFirst({ where: { caseId: caseDefinition.id } })
    if (existingVersion) continue // don't re-seed drop tables for an already-versioned case

    const skinsInCase = c.skinSlugs.map((slug) => {
      const skin = skinBySlug.get(slug)
      if (!skin) throw new Error(`Ukjent skin-slug i caseSeeds: ${slug}`)
      return { slug, id: skin.id, rarity: skin.rarity }
    })
    const weights = buildDropWeights(skinsInCase)
    const totalWeight = [...weights.values()].reduce((sum, w) => sum + w, 0)

    const version = await prisma.caseVersion.create({
      data: {
        caseId: caseDefinition.id,
        version: 1,
        totalWeight,
        publishedAt: new Date(), // seeded cases go live immediately
        createdBy: 'seed-script',
        drops: {
          create: skinsInCase.map((s) => ({ skinDefinitionId: s.id, weight: weights.get(s.slug)! })),
        },
      },
    })

    console.log(`Seedet case "${c.name}" v${version.version} (${skinsInCase.length} skins, totalWeight=${totalWeight}).`)
  }
}

async function seedAchievementsAndMissions() {
  await prisma.achievement.upsert({
    where: { slug: 'first-case-opened' },
    update: {},
    create: { slug: 'first-case-opened', name: 'Første åpning', description: 'Åpne din første case.', rewardCredits: 50 },
  })
  await prisma.achievement.upsert({
    where: { slug: 'case-veteran' },
    update: {},
    create: { slug: 'case-veteran', name: 'Case-veteran', description: 'Åpne 10 cases.', rewardCredits: 200 },
  })
  await prisma.achievement.upsert({
    where: { slug: 'first-sale' },
    update: {},
    create: { slug: 'first-sale', name: 'Første salg', description: 'Selg et objekt på markedet.', rewardCredits: 100 },
  })
  await prisma.achievement.upsert({
    where: { slug: 'collector-10' },
    update: {},
    create: { slug: 'collector-10', name: 'Samler', description: 'Eier 10 objekter samtidig.', rewardCredits: 150 },
  })

  await prisma.mission.upsert({
    where: { slug: 'open-cases-weekly' },
    update: {},
    create: {
      slug: 'open-cases-weekly',
      name: 'Ukentlig åpner',
      description: 'Åpne 5 cases denne uken.',
      targetValue: 5,
      rewardCredits: 300,
    },
  })
}

// Fase 1: nok data til å logge inn og se en wallet med startsaldo.
// Fase 3: 50+ skins og 5 cases med publiserte, korrekt vektede drop-tabeller.
// Fase 5: achievements og en mission som de sosiale hookene faktisk kan låse opp.
async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neoncrate.local' },
    update: {},
    create: {
      email: 'admin@neoncrate.local',
      username: 'admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      wallet: { create: { balance: STARTING_BALANCE } },
    },
  })

  await seedSkinsAndCases()
  await seedAchievementsAndMissions()

  console.log(`Seedet admin (${admin.username}).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
