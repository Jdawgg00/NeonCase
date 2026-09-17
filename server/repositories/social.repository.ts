import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { fallbackValueForRarity } from '~~/types/fallback-prices'

type Db = Prisma.TransactionClient | typeof prisma

/** Real Steam value in whole kr when known, otherwise a small per-rarity fallback (see types/fallback-prices.ts). */
function referenceValue(skin: { rarity: string; steamPriceCents: number | null }): number {
  return skin.steamPriceCents != null ? Math.round(skin.steamPriceCents / 100) : fallbackValueForRarity(skin.rarity)
}

export const socialRepository = {
  // --- Achievements ---
  findAchievementBySlug(slug: string, db: Db = prisma) {
    return db.achievement.findUnique({ where: { slug } })
  },

  hasUnlocked(userId: string, achievementId: string, db: Db = prisma) {
    return db.userAchievement.findUnique({ where: { userId_achievementId: { userId, achievementId } } })
  },

  unlockAchievement(userId: string, achievementId: string, db: Db = prisma) {
    return db.userAchievement.create({ data: { userId, achievementId } })
  },

  listUserAchievements(userId: string, db: Db = prisma) {
    return db.userAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { unlockedAt: 'desc' } })
  },

  // --- Missions ---
  listActiveMissions(db: Db = prisma) {
    const now = new Date()
    return db.mission.findMany({
      where: { AND: [{ OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] }, { OR: [{ activeTo: null }, { activeTo: { gte: now } }] }] },
    })
  },

  findUserMissionProgress(userId: string, missionId: string, db: Db = prisma) {
    return db.userMissionProgress.findUnique({ where: { userId_missionId: { userId, missionId } } })
  },

  upsertMissionProgress(userId: string, missionId: string, progress: number, completedAt: Date | null, db: Db = prisma) {
    return db.userMissionProgress.upsert({
      where: { userId_missionId: { userId, missionId } },
      update: { progress, ...(completedAt ? { completedAt } : {}) },
      create: { userId, missionId, progress, completedAt: completedAt ?? undefined },
    })
  },

  markMissionClaimed(userId: string, missionId: string, db: Db = prisma) {
    return db.userMissionProgress.update({ where: { userId_missionId: { userId, missionId } }, data: { claimedAt: new Date() } })
  },

  listUserMissionProgress(userId: string, db: Db = prisma) {
    return db.userMissionProgress.findMany({ where: { userId }, include: { mission: true } })
  },

  // --- Leaderboards (admin/test accounts excluded via role filter upstream) ---
  async topInventoryValue(excludeRoles: string[], take = 20, db: Db = prisma) {
    // Prisma can't sum a joined column directly in groupBy, so aggregate in
    // application code — acceptable at this data volume; revisit with a
    // materialized view if the leaderboard page gets slow.
    const rows = await db.inventoryItem.findMany({
      where: { owner: { role: { notIn: excludeRoles as never[] } } },
      select: {
        ownerId: true,
        skinDefinition: { select: { rarity: true, steamPriceCents: true } },
        owner: { select: { username: true } },
      },
    })
    const totals = new Map<string, { username: string; value: number }>()
    for (const row of rows) {
      const entry = totals.get(row.ownerId) ?? { username: row.owner.username, value: 0 }
      entry.value += referenceValue(row.skinDefinition)
      totals.set(row.ownerId, entry)
    }
    return [...totals.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, take)
  },

  /** Total kr each user has received via an admin wallet-adjustment credit — just for fun. */
  async topAdminGifted(excludeRoles: string[], take = 20, db: Db = prisma) {
    const grouped = await db.walletTransaction.groupBy({
      by: ['walletId'],
      where: { type: 'ADMIN_ADJUSTMENT_CREDIT' },
      _sum: { amount: true },
    })
    if (grouped.length === 0) return []

    const wallets = await db.wallet.findMany({
      where: { id: { in: grouped.map((g) => g.walletId) }, user: { role: { notIn: excludeRoles as never[] } } },
      select: { id: true, user: { select: { username: true } } },
    })
    const usernameByWalletId = new Map(wallets.map((w) => [w.id, w.user.username]))

    return grouped
      .filter((g) => usernameByWalletId.has(g.walletId))
      .map((g) => ({ username: usernameByWalletId.get(g.walletId)!, amount: g._sum.amount ?? 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, take)
  },

  topCaseOpenings(excludeRoles: string[], take = 20, db: Db = prisma) {
    return db.user.findMany({
      where: { role: { notIn: excludeRoles as never[] } },
      select: { id: true, username: true, _count: { select: { caseOpenings: true } } },
      orderBy: { caseOpenings: { _count: 'desc' } },
      take,
    })
  },

  /** Every SPECIAL-rarity ("gold") case opening ever, newest first — a hall of fame, not just today's best. */
  allSpecialDrops(excludeRoles: string[], take = 50, db: Db = prisma) {
    return db.caseOpening.findMany({
      where: {
        user: { role: { notIn: excludeRoles as never[] } },
        inventoryItem: { skinDefinition: { rarity: 'SPECIAL' } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        user: { select: { username: true } },
        case: { select: { name: true } },
        inventoryItem: { select: { patternSeed: true, skinDefinition: { select: { name: true } } } },
      },
    })
  },

  /**
   * Best drop today, per rarity tier — comparing a gold's small per-rarity
   * fallback value against a common skin's real (possibly much higher)
   * Steam price is an apples-to-oranges comparison that let a real 300 kr
   * common beat a knife every time. One winner per tier instead, so a gold
   * always shows up as *a* best-of-day even with no Steam price yet.
   */
  async todaysBestByRarity(excludeRoles: string[], db: Db = prisma) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const openings = await db.caseOpening.findMany({
      where: { createdAt: { gte: todayStart }, user: { role: { notIn: excludeRoles as never[] } } },
      select: {
        id: true,
        createdAt: true,
        user: { select: { username: true } },
        case: { select: { name: true } },
        inventoryItem: { select: { skinDefinition: { select: { name: true, rarity: true, steamPriceCents: true } } } },
      },
    })

    const toDto = (o: (typeof openings)[number]) => ({
      username: o.user.username,
      skinName: o.inventoryItem.skinDefinition.name,
      rarity: o.inventoryItem.skinDefinition.rarity,
      caseName: o.case.name,
      value: referenceValue(o.inventoryItem.skinDefinition),
      createdAt: o.createdAt,
    })

    const bestByRarity = new Map<string, (typeof openings)[number]>()
    for (const o of openings) {
      const rarity = o.inventoryItem.skinDefinition.rarity
      const current = bestByRarity.get(rarity)
      if (!current || referenceValue(o.inventoryItem.skinDefinition) > referenceValue(current.inventoryItem.skinDefinition)) {
        bestByRarity.set(rarity, o)
      }
    }
    const RARITY_ORDER = ['SPECIAL', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']
    return RARITY_ORDER.filter((r) => bestByRarity.has(r)).map((r) => toDto(bestByRarity.get(r)!))
  },

  // --- Notifications ---
  createNotification(
    data: { userId: string; type: string; title: string; body: string; metadata?: Prisma.InputJsonValue },
    db: Db = prisma,
  ) {
    return db.notification.create({ data })
  },

  listNotifications(userId: string, take = 20, db: Db = prisma) {
    return db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
  },

  markNotificationRead(id: string, db: Db = prisma) {
    return db.notification.update({ where: { id }, data: { readAt: new Date() } })
  },
}
