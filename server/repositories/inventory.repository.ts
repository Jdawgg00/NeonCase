import type { InventoryItemStatus, Prisma, Rarity, WeaponCategory } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface InventoryFilter {
  ownerId: string
  status?: InventoryItemStatus[]
  rarity?: Rarity[]
  weaponCategory?: WeaponCategory[]
  sort?: 'value_desc' | 'value_asc' | 'newest' | 'name'
  cursor?: string
  take?: number
}

export const inventoryRepository = {
  create(
    data: {
      ownerId: string
      skinDefinitionId: string
      sourceType: string
      sourceId?: string
      floatValue: number
      wear: Prisma.InventoryItemCreateInput['wear']
      patternSeed: number
      specialVariant?: string
    },
    db: Db = prisma,
  ) {
    return db.inventoryItem.create({ data })
  },

  findById(id: string, db: Db = prisma) {
    return db.inventoryItem.findUnique({ where: { id }, include: { skinDefinition: true } })
  },

  async list(filter: InventoryFilter, db: Db = prisma) {
    const orderBy: Prisma.InventoryItemOrderByWithRelationInput =
      filter.sort === 'value_desc'
        ? { skinDefinition: { baseReferenceValue: 'desc' } }
        : filter.sort === 'value_asc'
          ? { skinDefinition: { baseReferenceValue: 'asc' } }
          : filter.sort === 'name'
            ? { skinDefinition: { name: 'asc' } }
            : { acquiredAt: 'desc' }

    return db.inventoryItem.findMany({
      where: {
        ownerId: filter.ownerId,
        ...(filter.status ? { status: { in: filter.status } } : {}),
        ...(filter.rarity || filter.weaponCategory
          ? {
              skinDefinition: {
                ...(filter.rarity ? { rarity: { in: filter.rarity } } : {}),
                ...(filter.weaponCategory ? { weaponCategory: { in: filter.weaponCategory } } : {}),
              },
            }
          : {}),
      },
      include: { skinDefinition: true },
      orderBy,
      take: filter.take ?? 24,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    })
  },

  setStatus(id: string, status: InventoryItemStatus, db: Db = prisma) {
    return db.inventoryItem.update({ where: { id }, data: { status } })
  },

  setFavorited(id: string, favorited: boolean, db: Db = prisma) {
    return db.inventoryItem.update({ where: { id }, data: { favorited } })
  },

  /** Optimistic guard: only flips AVAILABLE -> LOCKED (or back) if it's still in the expected state. */
  async tryTransitionStatus(id: string, from: InventoryItemStatus, to: InventoryItemStatus, db: Db = prisma) {
    const result = await db.inventoryItem.updateMany({ where: { id, status: from }, data: { status: to } })
    return result.count === 1
  },

  transferOwnership(id: string, newOwnerId: string, db: Db = prisma) {
    return db.inventoryItem.update({ where: { id }, data: { ownerId: newOwnerId, status: 'AVAILABLE' } })
  },

  countByOwner(ownerId: string, db: Db = prisma) {
    return db.inventoryItem.count({ where: { ownerId } })
  },

  async totalValueByOwner(ownerId: string, db: Db = prisma) {
    const result = await db.inventoryItem.findMany({
      where: { ownerId },
      select: { skinDefinition: { select: { baseReferenceValue: true } } },
    })
    return result.reduce((sum, item) => sum + item.skinDefinition.baseReferenceValue, 0)
  },
}
