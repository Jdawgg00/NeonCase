import type { CaseStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export const catalogRepository = {
  listActiveCases(db: Db = prisma) {
    const now = new Date()
    return db.caseDefinition.findMany({
      where: {
        status: 'ACTIVE',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { casePrice: 'asc' },
    })
  },

  findCaseBySlug(slug: string, db: Db = prisma) {
    return db.caseDefinition.findUnique({ where: { slug } })
  },

  /**
   * Case + the exact version currently sold to players, in one round-trip.
   * openCase uses this instead of findCaseBySlug + findPublishedVersion
   * because each separate query costs a full database round-trip, which
   * dominates that endpoint's response time.
   */
  findCaseWithPublishedVersion(slug: string, db: Db = prisma) {
    return db.caseDefinition.findUnique({
      where: { slug },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: 'desc' },
          take: 1,
          include: { drops: { where: { enabled: true }, include: { skinDefinition: true } } },
        },
      },
    })
  },

  /** The version actually sold to players right now — the only one openCase may use. */
  findPublishedVersion(caseId: string, db: Db = prisma) {
    return db.caseVersion.findFirst({
      where: { caseId, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
      include: { drops: { where: { enabled: true }, include: { skinDefinition: true } } },
    })
  },

  findVersionById(caseVersionId: string, db: Db = prisma) {
    return db.caseVersion.findUnique({
      where: { id: caseVersionId },
      include: { drops: { where: { enabled: true }, include: { skinDefinition: true } } },
    })
  },

  findSkinById(skinDefinitionId: string, db: Db = prisma) {
    return db.skinDefinition.findUniqueOrThrow({ where: { id: skinDefinitionId } })
  },

  listAllSkins(db: Db = prisma) {
    return db.skinDefinition.findMany({ orderBy: [{ rarity: 'asc' }, { name: 'asc' }] })
  },

  listAllCases(db: Db = prisma) {
    return db.caseDefinition.findMany({
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
  },

  // --- Admin write paths (used by Fase 6 admin.service) ---

  createSkin(data: Prisma.SkinDefinitionCreateInput, db: Db = prisma) {
    return db.skinDefinition.create({ data })
  },

  createCase(data: Prisma.CaseDefinitionCreateInput, db: Db = prisma) {
    return db.caseDefinition.create({ data })
  },

  setCaseStatus(caseId: string, status: CaseStatus, db: Db = prisma) {
    return db.caseDefinition.update({ where: { id: caseId }, data: { status } })
  },

  async nextVersionNumber(caseId: string, db: Db = prisma) {
    const latest = await db.caseVersion.findFirst({ where: { caseId }, orderBy: { version: 'desc' } })
    return (latest?.version ?? 0) + 1
  },

  createVersionWithDrops(
    input: {
      caseId: string
      version: number
      createdBy: string
      drops: { skinDefinitionId: string; weight: number }[]
    },
    db: Db = prisma,
  ) {
    const totalWeight = input.drops.reduce((sum, d) => sum + d.weight, 0)
    return db.caseVersion.create({
      data: {
        caseId: input.caseId,
        version: input.version,
        totalWeight,
        createdBy: input.createdBy,
        drops: { create: input.drops.map((d) => ({ skinDefinitionId: d.skinDefinitionId, weight: d.weight })) },
      },
      include: { drops: true },
    })
  },

  publishVersion(caseVersionId: string, db: Db = prisma) {
    return db.caseVersion.update({ where: { id: caseVersionId }, data: { publishedAt: new Date() } })
  },
}
