import { requireUser } from '~~/server/utils/require-auth'
import { profileService, UserNotFoundError } from '~~/server/services/profile.service'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const username = getRouterParam(event, 'username')
  if (!username) throw createError({ statusCode: 400, statusMessage: 'Mangler brukernavn' })

  try {
    return await profileService.getPublicProfileByUsername(username)
  } catch (err) {
    if (err instanceof UserNotFoundError) throw createError({ statusCode: 404, statusMessage: 'Fant ikke brukeren' })
    throw err
  }
})
