import { requireUser } from '~~/server/utils/require-auth'
import { socialService } from '~~/server/services/social.service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Mangler slug' })

  try {
    const result = await socialService.claimMission(user.id, slug)
    return { balance: result.balance }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : 'Kunne ikke hente belønning' })
  }
})
