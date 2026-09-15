import { requireUser } from '~~/server/utils/require-auth'
import { inventoryService } from '~~/server/services/inventory.service'
import { toInventoryItemDTO, type InventoryItemDTO } from '~~/types/dto'
import type { InventoryItemStatus, Rarity, WeaponCategory } from '@prisma/client'

export default defineEventHandler(async (event): Promise<InventoryItemDTO[]> => {
  const user = await requireUser(event)
  const query = getQuery(event)

  const items = await inventoryService.list({
    ownerId: user.id,
    // Default view is "things you still have" — SOLD is a terminal history
    // state (from quick-sell), not something to browse alongside it.
    status: query.status
      ? ((query.status as string).split(',') as InventoryItemStatus[])
      : ['AVAILABLE', 'LOCKED', 'LISTED'],
    rarity: query.rarity ? ((query.rarity as string).split(',') as Rarity[]) : undefined,
    weaponCategory: query.weaponCategory ? ((query.weaponCategory as string).split(',') as WeaponCategory[]) : undefined,
    sort: query.sort as 'value_desc' | 'value_asc' | 'newest' | 'name' | undefined,
    cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
    take: Math.min(Number(query.take) || 24, 50),
  })

  return items.map(toInventoryItemDTO)
})
