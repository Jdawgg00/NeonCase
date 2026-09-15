import { requireUser } from '~~/server/utils/require-auth'
import { marketService } from '~~/server/services/market.service'
import { toMarketListingDTO, type MarketListingDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<MarketListingDTO[]> => {
  await requireUser(event)
  const query = getQuery(event)

  const listings = await marketService.search({
    search: typeof query.search === 'string' ? query.search : undefined,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
    take: Math.min(Number(query.take) || 24, 50),
  })

  return listings.map(toMarketListingDTO)
})
