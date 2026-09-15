import { requireUser } from '~~/server/utils/require-auth'
import { profileService } from '~~/server/services/profile.service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return profileService.getProfileByUserId(user.id)
})
