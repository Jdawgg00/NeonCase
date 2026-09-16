import { prisma } from '~~/server/utils/prisma'
import { socialRepository } from '~~/server/repositories/social.repository'
import { inventoryRepository } from '~~/server/repositories/inventory.repository'

// Admin/test/moderator accounts never appear on leaderboards — spesifikasjonen
// explicitly requires this so internal seed/test accounts can't top the board.
const LEADERBOARD_EXCLUDED_ROLES = ['ADMIN', 'MODERATOR']

async function unlockIfNew(userId: string, achievementSlug: string) {
  const achievement = await socialRepository.findAchievementBySlug(achievementSlug)
  if (!achievement) return // achievement not seeded — don't crash the caller's flow over it

  const already = await socialRepository.hasUnlocked(userId, achievement.id)
  if (already) return

  await prisma.$transaction(async (tx) => {
    await socialRepository.unlockAchievement(userId, achievement.id, tx)
    if (achievement.rewardCredits > 0) {
      const { applyBalanceDeltaTx } = await import('./wallet.service')
      await applyBalanceDeltaTx(tx, {
        userId,
        amount: achievement.rewardCredits,
        type: 'ACHIEVEMENT_REWARD',
        idempotencyKey: `achievement:${userId}:${achievement.id}`,
        referenceType: 'ACHIEVEMENT',
        referenceId: achievement.id,
      })
    }
  })
  await socialRepository.createNotification({
    userId,
    type: 'ACHIEVEMENT_UNLOCKED',
    title: 'Ny achievement!',
    body: achievement.name,
  })
}

export const socialService = {
  /** Called after every successful case opening. */
  async onCaseOpened(userId: string, totalOpeningsForUser: number) {
    if (totalOpeningsForUser === 1) await unlockIfNew(userId, 'first-case-opened')
    if (totalOpeningsForUser === 10) await unlockIfNew(userId, 'case-veteran')

    for (const mission of await socialRepository.listActiveMissions()) {
      if (!mission.slug.startsWith('open-cases')) continue
      const progress = await socialRepository.findUserMissionProgress(userId, mission.id)
      const newProgress = (progress?.progress ?? 0) + 1
      const completed = newProgress >= mission.targetValue
      await socialRepository.upsertMissionProgress(userId, mission.id, newProgress, completed ? new Date() : null)
    }
  },

  /** Called after every successful market sale, for the seller. */
  async onMarketSale(sellerId: string, totalSalesForSeller: number) {
    if (totalSalesForSeller === 1) await unlockIfNew(sellerId, 'first-sale')
  },

  async checkInventoryMilestones(userId: string) {
    const count = await inventoryRepository.countByOwner(userId)
    if (count >= 10) await unlockIfNew(userId, 'collector-10')
  },

  async claimMission(userId: string, missionSlug: string) {
    const missions = await socialRepository.listActiveMissions()
    const mission = missions.find((m) => m.slug === missionSlug)
    if (!mission) throw new Error('Fant ikke oppdraget')

    const progress = await socialRepository.findUserMissionProgress(userId, mission.id)
    if (!progress?.completedAt) throw new Error('Oppdraget er ikke fullført ennå')
    if (progress.claimedAt) throw new Error('Belønningen er allerede hentet')

    return prisma.$transaction(async (tx) => {
      await socialRepository.markMissionClaimed(userId, mission.id, tx)
      const { applyBalanceDeltaTx } = await import('./wallet.service')
      return applyBalanceDeltaTx(tx, {
        userId,
        amount: mission.rewardCredits,
        type: 'MISSION_REWARD',
        idempotencyKey: `mission:${userId}:${mission.id}`,
        referenceType: 'MISSION',
        referenceId: mission.id,
      })
    })
  },

  getUserAchievements(userId: string) {
    return socialRepository.listUserAchievements(userId)
  },

  getUserMissions(userId: string) {
    return socialRepository.listUserMissionProgress(userId)
  },

  getNotifications(userId: string) {
    return socialRepository.listNotifications(userId)
  },

  markNotificationRead(id: string) {
    return socialRepository.markNotificationRead(id)
  },

  async leaderboards() {
    const [byValue, byOpenings, todaysDrops] = await Promise.all([
      socialRepository.topInventoryValue(LEADERBOARD_EXCLUDED_ROLES),
      socialRepository.topCaseOpenings(LEADERBOARD_EXCLUDED_ROLES),
      socialRepository.todaysExtremeDrops(LEADERBOARD_EXCLUDED_ROLES),
    ])
    return {
      inventoryValue: byValue,
      caseOpenings: byOpenings.map((u) => ({ userId: u.id, username: u.username, count: u._count.caseOpenings })),
      todaysBestDrop: todaysDrops.best ? { ...todaysDrops.best, createdAt: todaysDrops.best.createdAt.toISOString() } : null,
      todaysWorstDrop: todaysDrops.worst ? { ...todaysDrops.worst, createdAt: todaysDrops.worst.createdAt.toISOString() } : null,
    }
  },
}
