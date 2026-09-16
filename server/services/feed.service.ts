import { prisma } from '~~/server/utils/prisma'
import type { FeedEntryDTO } from '~~/types/dto'

/**
 * Polling-based live feed of recent case openings, shown across all
 * players. No websocket/Redis dependency by design — the app's existing
 * pub/sub path (server/routes/ws/market.ts) needs Redis, which this
 * deployment doesn't have wired up. A client polling this every few
 * seconds is close enough to "live" for a social feed like this.
 */
export const feedService = {
  async recentOpenings(take = 30): Promise<FeedEntryDTO[]> {
    const openings = await prisma.caseOpening.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        user: { select: { username: true } },
        case: { select: { name: true } },
        inventoryItem: { select: { skinDefinition: { select: { name: true, rarity: true } } } },
      },
    })

    return openings.map((o) => ({
      id: o.id,
      username: o.user.username,
      skinName: o.inventoryItem.skinDefinition.name,
      rarity: o.inventoryItem.skinDefinition.rarity,
      caseName: o.case.name,
      createdAt: o.createdAt.toISOString(),
    }))
  },
}
