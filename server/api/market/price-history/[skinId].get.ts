import { requireUser } from '~~/server/utils/require-auth'
import { marketService } from '~~/server/services/market.service'
import type { PriceHistoryPointDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<PriceHistoryPointDTO[]> => {
  await requireUser(event)
  const skinId = getRouterParam(event, 'skinId')
  if (!skinId) throw createError({ statusCode: 400, statusMessage: 'Mangler skinId' })

  const sales = await marketService.priceHistory(skinId)
  return sales.map((s) => ({ price: s.grossAmount, soldAt: s.createdAt.toISOString() })).reverse()
})
