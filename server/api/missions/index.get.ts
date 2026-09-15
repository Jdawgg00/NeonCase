import { requireUser } from '~~/server/utils/require-auth'
import { socialService } from '~~/server/services/social.service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const progress = await socialService.getUserMissions(user.id)
  return progress.map((p) => ({
    slug: p.mission.slug,
    name: p.mission.name,
    description: p.mission.description,
    progress: p.progress,
    targetValue: p.mission.targetValue,
    rewardCredits: p.mission.rewardCredits,
    completedAt: p.completedAt?.toISOString() ?? null,
    claimedAt: p.claimedAt?.toISOString() ?? null,
  }))
})
