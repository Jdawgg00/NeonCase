import { requireUser } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { marketService } from '~~/server/services/market.service'
import { createListingSchema } from '~~/types/schemas/market'
import { ItemNotAvailableError, NotOwnerError, ValidationError } from '~~/server/services/errors'
import { toMarketListingDTO } from '~~/types/dto'
import { marketRepository } from '~~/server/repositories/market.repository'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const withinLimit = await checkRateLimit(`market-list:${user.id}`, 20, 60)
  if (!withinLimit) throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })

  const parsed = createListingSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  try {
    const listing = await marketService.listItem({
      sellerId: user.id,
      inventoryItemId: parsed.data.inventoryItemId,
      price: parsed.data.price,
    })
    const full = await marketRepository.findById(listing.id)
    return toMarketListingDTO(full!)
  } catch (err) {
    if (err instanceof NotOwnerError) throw createError({ statusCode: 403, statusMessage: err.message })
    if (err instanceof ItemNotAvailableError) throw createError({ statusCode: 409, statusMessage: err.message })
    if (err instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
})
