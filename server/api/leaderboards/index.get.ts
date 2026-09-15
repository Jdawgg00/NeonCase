import { requireUser } from '~~/server/utils/require-auth'
import { socialService } from '~~/server/services/social.service'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return socialService.leaderboards()
})
