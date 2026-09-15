import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface MarketSearchFilter {
  search?: string
  minPrice?: number
  maxPrice?: number
  cursor?: string
  take?: number
}

export const marketRepository = {
  createListing(data: { sellerId: string; inventoryItemId: string; price: number; feeRate: number }, db: Db = prisma) {
    return db.marketListing.create({ data })
  },

  findActiveById(id: string, db: Db = prisma) {
    return db.marketListing.findFirst({
      where: { id, status: 'ACTIVE' },
      include: { inventoryItem: { include: { skinDefinition: true } } },
    })
  },

  findById(id: string, db: Db = prisma) {
    return db.marketListing.findUnique({ where: { id }, include: { inventoryItem: { include: { skinDefinition: true } } } })
  },

  /**
   * Conditional update: only one concurrent caller can flip a given
   * listing from ACTIVE to SOLD/CANCELLED. Anyone else gets count === 0 and
   * must treat the listing as already gone — this is what guarantees "only
   * one buyer can win" without needing an explicit row lock.
   */
  async tryTransitionStatus(id: string, to: 'SOLD' | 'CANCELLED', db: Db = prisma) {
    const result = await db.marketListing.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: to, ...(to === 'SOLD' ? { soldAt: new Date() } : { cancelledAt: new Date() }) },
    })
    return result.count === 1
  },

  search(filter: MarketSearchFilter, db: Db = prisma) {
    return db.marketListing.findMany({
      where: {
        status: 'ACTIVE',
        ...(filter.minPrice !== undefined || filter.maxPrice !== undefined
          ? { price: { gte: filter.minPrice, lte: filter.maxPrice } }
          : {}),
        ...(filter.search
          ? { inventoryItem: { skinDefinition: { name: { contains: filter.search, mode: 'insensitive' } } } }
          : {}),
      },
      include: { inventoryItem: { include: { skinDefinition: true } } },
      orderBy: { listedAt: 'desc' },
      take: filter.take ?? 24,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    })
  },

  listBySeller(sellerId: string, db: Db = prisma) {
    return db.marketListing.findMany({
      where: { sellerId, status: 'ACTIVE' },
      include: { inventoryItem: { include: { skinDefinition: true } } },
      orderBy: { listedAt: 'desc' },
    })
  },

  createSale(
    data: { listingId: string; buyerId: string; sellerId: string; grossAmount: number; feeAmount: number; sellerNetAmount: number },
    db: Db = prisma,
  ) {
    return db.marketSale.create({ data })
  },

  recentSalesForSkin(skinDefinitionId: string, take = 20, db: Db = prisma) {
    return db.marketSale.findMany({
      where: { listing: { inventoryItem: { skinDefinitionId } } },
      orderBy: { createdAt: 'desc' },
      take,
      select: { grossAmount: true, createdAt: true },
    })
  },
}
