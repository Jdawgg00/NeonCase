import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

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
      select: { ownerId: true, skinDefinition: { select: { baseReferenceValue: true } }, owner: { select: { username: true } } },
    })
    const totals = new Map<string, { username: string; value: number }>()
    for (const row of rows) {
      const entry = totals.get(row.ownerId) ?? { username: row.owner.username, value: 0 }
      entry.value += row.skinDefinition.baseReferenceValue
      totals.set(row.ownerId, entry)
    }
    return [...totals.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.value - a.value)
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
