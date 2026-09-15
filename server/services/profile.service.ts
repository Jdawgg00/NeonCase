import { prisma } from '~~/server/utils/prisma'
import { inventoryRepository } from '~~/server/repositories/inventory.repository'

export class UserNotFoundError extends Error {
  constructor() {
    super('Fant ikke brukeren')
    this.name = 'UserNotFoundError'
  }
}

export const profileService = {
  async getProfileByUserId(userId: string) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, image: true, createdAt: true, publicProfile: true },
    })
    if (!dbUser) throw new UserNotFoundError()
    return buildStats(userId, dbUser)
  },

  /** Public lookup by username — respects the privacy flag, never leaks account/email data. */
  async getPublicProfileByUsername(username: string) {
    const dbUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, image: true, createdAt: true, publicProfile: true },
    })
    if (!dbUser || !dbUser.publicProfile) throw new UserNotFoundError()
    return buildStats(dbUser.id, dbUser)
  },
}

async function buildStats(userId: string, dbUser: { username: string; image: string | null; createdAt: Date; publicProfile: boolean }) {
  const [inventoryValue, openingsCount, bestDrop, salesAsSeller, purchasesAsBuyer, achievementsCount] = await Promise.all([
    inventoryRepository.totalValueByOwner(userId),
    prisma.caseOpening.count({ where: { userId } }),
    prisma.inventoryItem.findFirst({
      where: { ownerId: userId },
      orderBy: { skinDefinition: { baseReferenceValue: 'desc' } },
      include: { skinDefinition: true },
    }),
    prisma.marketSale.aggregate({ where: { sellerId: userId }, _sum: { grossAmount: true } }),
    prisma.marketSale.aggregate({ where: { buyerId: userId }, _sum: { grossAmount: true } }),
    prisma.userAchievement.count({ where: { userId } }),
  ])

  return {
    username: dbUser.username,
    image: dbUser.image,
    memberSince: dbUser.createdAt.toISOString(),
    publicProfile: dbUser.publicProfile,
    inventoryValue,
    caseOpeningsCount: openingsCount,
    bestDrop: bestDrop
      ? { name: bestDrop.skinDefinition.name, rarity: bestDrop.skinDefinition.rarity, value: bestDrop.skinDefinition.baseReferenceValue }
      : null,
    tradeVolume: (salesAsSeller._sum.grossAmount ?? 0) + (purchasesAsBuyer._sum.grossAmount ?? 0),
    achievementsCount,
  }
}
