import { requireUser } from '~~/server/utils/require-auth'
import { inventoryService } from '~~/server/services/inventory.service'
import { inventoryFavoriteSchema } from '~~/types/schemas/market'
import { NotOwnerError, ItemNotAvailableError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const parsed = inventoryFavoriteSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Ugyldig input' })

  try {
    const item = await inventoryService.toggleFavorite(user.id, id, parsed.data.favorited)
    return { favorited: item.favorited }
  } catch (err) {
    if (err instanceof NotOwnerError) throw createError({ statusCode: 403, statusMessage: err.message })
    if (err instanceof ItemNotAvailableError) throw createError({ statusCode: 404, statusMessage: err.message })
    throw err
  }
})
