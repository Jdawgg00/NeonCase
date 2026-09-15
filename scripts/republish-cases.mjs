import { PrismaClient } from '@prisma/client'
import { skinSeeds } from '../prisma/seed-data/skins.ts'
import { caseSeeds } from '../prisma/seed-data/cases.ts'
import { buildDropWeights } from '../server/utils/case-odds.ts'

const prisma = new PrismaClient()

const skinBySlug = new Map()
for (const s of skinSeeds) {
  const row = await prisma.skinDefinition.findUniqueOrThrow({ where: { slug: s.slug } })
  skinBySlug.set(s.slug, { id: row.id, rarity: row.rarity })
}

for (const c of caseSeeds) {
  const caseDefinition = await prisma.caseDefinition.findUniqueOrThrow({ where: { slug: c.slug } })

  const skinsInCase = c.skinSlugs.map((slug) => {
    const skin = skinBySlug.get(slug)
    if (!skin) throw new Error(`Ukjent skin-slug: ${slug}`)
    return { slug, id: skin.id, rarity: skin.rarity }
  })
  const weights = buildDropWeights(skinsInCase)
  const totalWeight = [...weights.values()].reduce((sum, w) => sum + w, 0)

  const latest = await prisma.caseVersion.findFirst({ where: { caseId: caseDefinition.id }, orderBy: { version: 'desc' } })
  const nextVersion = (latest?.version ?? 0) + 1

  const version = await prisma.caseVersion.create({
    data: {
      caseId: caseDefinition.id,
      version: nextVersion,
      totalWeight,
      publishedAt: new Date(),
      createdBy: 'republish-script',
      drops: {
        create: skinsInCase.map((s) => ({ skinDefinitionId: s.id, weight: weights.get(s.slug) })),
      },
    },
  })

  console.log(`Published "${c.name}" v${version.version} (${skinsInCase.length} skins, totalWeight=${totalWeight}).`)
}

await prisma.$disconnect()
