import { requireUser } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { marketService } from '~~/server/services/market.service'
import { quickSellSchema } from '~~/types/schemas/market'
import { ItemNotAvailableError, NotOwnerError, ValidationError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const withinLimit = await checkRateLimit(`quick-sell:${user.id}`, 20, 60)
  if (!withinLimit) throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })

  const parsed = quickSellSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Ugyldig input' })

  try {
    const { price, balance } = await marketService.quickSell({
      sellerId: user.id,
      inventoryItemId: id,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return { price, balance }
  } catch (err) {
    if (err instanceof NotOwnerError) throw createError({ statusCode: 403, statusMessage: err.message })
    if (err instanceof ItemNotAvailableError) throw createError({ statusCode: 409, statusMessage: err.message })
    if (err instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
})
