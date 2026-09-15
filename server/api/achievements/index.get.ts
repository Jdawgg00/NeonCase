import { requireUser } from '~~/server/utils/require-auth'
import { socialService } from '~~/server/services/social.service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const unlocked = await socialService.getUserAchievements(user.id)
  return unlocked.map((u) => ({
    slug: u.achievement.slug,
    name: u.achievement.name,
    description: u.achievement.description,
    unlockedAt: u.unlockedAt.toISOString(),
  }))
})
