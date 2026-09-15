import { inventoryRepository, type InventoryFilter } from '~~/server/repositories/inventory.repository'
import { NotOwnerError, ItemNotAvailableError } from './errors'

export const inventoryService = {
  list(filter: InventoryFilter) {
    return inventoryRepository.list(filter)
  },

  async toggleFavorite(userId: string, itemId: string, favorited: boolean) {
    const item = await inventoryRepository.findById(itemId)
    if (!item) throw new ItemNotAvailableError('Fant ikke objektet')
    if (item.ownerId !== userId) throw new NotOwnerError()
    return inventoryRepository.setFavorited(itemId, favorited)
  },

  async toggleLock(userId: string, itemId: string, locked: boolean) {
    const item = await inventoryRepository.findById(itemId)
    if (!item) throw new ItemNotAvailableError('Fant ikke objektet')
    if (item.ownerId !== userId) throw new NotOwnerError()

    const from = locked ? 'AVAILABLE' : 'LOCKED'
    const to = locked ? 'LOCKED' : 'AVAILABLE'
    if (item.status !== from) {
      throw new ItemNotAvailableError(locked ? 'Objektet kan ikke låses akkurat nå (f.eks. allerede listet)' : 'Objektet er ikke låst')
    }
    const applied = await inventoryRepository.tryTransitionStatus(itemId, from, to)
    if (!applied) throw new ItemNotAvailableError('Objektets status endret seg akkurat nå — prøv igjen')
    return inventoryRepository.findById(itemId)
  },
}
