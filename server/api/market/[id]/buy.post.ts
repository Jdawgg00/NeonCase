import { requireUser } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { marketService } from '~~/server/services/market.service'
import { buyListingSchema } from '~~/types/schemas/market'
import { CannotBuyOwnListingError, InsufficientFundsError, ListingUnavailableError, ValidationError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const withinLimit = await checkRateLimit(`market-buy:${user.id}`, 20, 60)
  if (!withinLimit) throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })

  const parsed = buyListingSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Ugyldig input' })

  try {
    const { sale, replay } = await marketService.buyListing({
      buyerId: user.id,
      listingId: id,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return { saleId: sale.id, grossAmount: sale.grossAmount, replay }
  } catch (err) {
    if (err instanceof InsufficientFundsError) throw createError({ statusCode: 400, statusMessage: 'Ikke nok credits' })
    if (err instanceof ListingUnavailableError) throw createError({ statusCode: 409, statusMessage: err.message })
    if (err instanceof CannotBuyOwnListingError) throw createError({ statusCode: 400, statusMessage: err.message })
    if (err instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
})
