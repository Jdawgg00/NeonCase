import { prisma } from '~~/server/utils/prisma'
import { catalogRepository } from '~~/server/repositories/catalog.repository'
import { adminRepository } from '~~/server/repositories/admin.repository'
import { auditLogRepository } from '~~/server/repositories/audit-log.repository'
import { caseSeeds } from '~~/prisma/seed-data/cases'
import { ValidationError } from './errors'

export const adminService = {
  listUsers() {
    return adminRepository.listUsers()
  },

  listSkins() {
    return catalogRepository.listAllSkins()
  },

  listCases() {
    return catalogRepository.listAllCases()
  },

  createSkin(input: {
    slug: string
    name: string
    weaponCategory: string
    rarity: string
    baseReferenceValue: number
    imageUrl?: string
  }) {
    return catalogRepository.createSkin({
      slug: input.slug,
      name: input.name,
      weaponCategory: input.weaponCategory as never,
      rarity: input.rarity as never,
      baseReferenceValue: input.baseReferenceValue,
      imageUrl: input.imageUrl,
      specialEligible: input.rarity === 'SPECIAL',
    })
  },

  createCase(input: { slug: string; name: string; description: string; casePrice: number; keyPrice?: number }) {
    return catalogRepository.createCase({
      slug: input.slug,
      name: input.name,
      description: input.description,
      casePrice: input.casePrice,
      keyPrice: input.keyPrice,
      status: 'DRAFT',
    })
  },

  /**
   * Publishes a new versioned drop table for a case. Never mutates a past
   * version — historical CaseOpenings keep pointing at the CaseVersion they
   * were actually rolled against, exactly as the spec requires.
   */
  async publishNewVersion(input: { caseId: string; createdBy: string; drops: { skinDefinitionId: string; weight: number }[] }) {
    if (input.drops.length === 0) throw new ValidationError('En case-versjon må ha minst én drop')
    if (input.drops.some((d) => !Number.isInteger(d.weight) || d.weight < 0)) {
      throw new ValidationError('Alle vekter må være ikke-negative heltall')
    }

    return prisma.$transaction(async (tx) => {
      const nextVersion = await catalogRepository.nextVersionNumber(input.caseId, tx)
      const version = await catalogRepository.createVersionWithDrops(
        { caseId: input.caseId, version: nextVersion, createdBy: input.createdBy, drops: input.drops },
        tx,
      )
      const published = await catalogRepository.publishVersion(version.id, tx)
      await auditLogRepository.record(
        { actorId: input.createdBy, action: 'CASE_VERSION_PUBLISHED', metadata: { caseId: input.caseId, versionId: version.id } },
        tx,
      )
      return published
    })
  },

  setCaseStatus(caseId: string, status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') {
    return catalogRepository.setCaseStatus(caseId, status)
  },

  async suspendUser(input: { actorId: string; targetUserId: string; status: 'SUSPENDED' | 'BANNED' | 'ACTIVE'; reason: string }) {
    if (input.reason.trim().length < 10) throw new ValidationError('reason må forklare handlingen med minst 10 tegn')

    return prisma.$transaction(async (tx) => {
      const user = await adminRepository.setUserStatus(input.targetUserId, input.status, tx)
      await auditLogRepository.record(
        { actorId: input.actorId, targetId: input.targetUserId, action: `USER_STATUS_${input.status}`, reason: input.reason },
        tx,
      )
      return user
    })
  },

  economyReport() {
    return adminRepository.economySnapshot()
  },

  auditLog(take?: number) {
    return adminRepository.listAuditLog(take)
  },

  /**
   * One-off cleanup for the seeded tester01..20/guest accounts (the seed
   * script no longer creates them, but any that already exist in a live
   * database need explicit removal). Deletes in FK order: MarketSale ->
   * MarketListing -> CaseOpening -> InventoryItem -> User. Wallet,
   * WalletTransaction, UserAchievement, UserMissionProgress and
   * Notification all cascade automatically on User delete. Only ever
   * touches rows owned by a test/guest user right now — an item a test
   * user sold to a real player, now owned by that real player, is left
   * alone.
   */
  async purgeTestUsers(actorId: string) {
    const testUsers = await prisma.user.findMany({
      where: { OR: [{ username: { startsWith: 'tester', mode: 'insensitive' } }, { username: { equals: 'guest', mode: 'insensitive' } }] },
      select: { id: true, username: true },
    })
    const testUserIds = testUsers.map((u) => u.id)
    if (testUserIds.length === 0) return { deletedUsers: 0, usernames: [] }

    await prisma.$transaction(async (tx) => {
      await tx.marketSale.deleteMany({ where: { OR: [{ buyerId: { in: testUserIds } }, { sellerId: { in: testUserIds } }] } })
      await tx.marketListing.deleteMany({ where: { sellerId: { in: testUserIds } } })
      await tx.caseOpening.deleteMany({ where: { userId: { in: testUserIds } } })
      await tx.inventoryItem.deleteMany({ where: { ownerId: { in: testUserIds } } })
      await tx.user.deleteMany({ where: { id: { in: testUserIds } } })
      await auditLogRepository.record(
        { actorId, action: 'ADMIN_PURGE_TEST_USERS', metadata: { count: testUserIds.length, usernames: testUsers.map((u) => u.username) } },
        tx,
      )
    })

    return { deletedUsers: testUserIds.length, usernames: testUsers.map((u) => u.username) }
  },

  /**
   * One-time fix for cases that were created back when the seed script's
   * upsert still overwrote casePrice/keyPrice on every boot (so the DB row
   * already existed with the old 500/100 placeholder before that behavior
   * was removed) -- an upsert's `update` branch never fires `create`, so
   * seed.ts no longer touching an existing row also means it never fixes
   * one. Explicit, admin-triggered, and safe to run more than once.
   */
  async syncCasePricesFromSeed(actorId: string) {
    const updated: string[] = []
    await prisma.$transaction(async (tx) => {
      for (const c of caseSeeds) {
        const result = await tx.caseDefinition.updateMany({
          where: { slug: c.slug, NOT: { casePrice: c.casePrice, keyPrice: c.keyPrice } },
          data: { casePrice: c.casePrice, keyPrice: c.keyPrice },
        })
        if (result.count > 0) updated.push(c.name)
      }
      if (updated.length > 0) {
        await auditLogRepository.record({ actorId, action: 'ADMIN_SYNC_CASE_PRICES', metadata: { cases: updated } }, tx)
      }
    })
    return { updated }
  },
}
