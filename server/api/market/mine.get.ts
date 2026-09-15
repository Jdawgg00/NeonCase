import { requireUser } from '~~/server/utils/require-auth'
import { marketService } from '~~/server/services/market.service'
import { toMarketListingDTO, type MarketListingDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<MarketListingDTO[]> => {
  const user = await requireUser(event)
  const listings = await marketService.mySellerListings(user.id)
  return listings.map(toMarketListingDTO)
})
