import { requireUser } from '~~/server/utils/require-auth'
import { marketService } from '~~/server/services/market.service'
import { ListingUnavailableError, NotOwnerError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  try {
    await marketService.cancelListing({ sellerId: user.id, listingId: id })
    return { cancelled: true }
  } catch (err) {
    if (err instanceof NotOwnerError) throw createError({ statusCode: 403, statusMessage: err.message })
    if (err instanceof ListingUnavailableError) throw createError({ statusCode: 409, statusMessage: err.message })
    throw err
  }
})
