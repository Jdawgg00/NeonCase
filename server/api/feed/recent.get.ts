import { requireUser } from '~~/server/utils/require-auth'
import { feedService } from '~~/server/services/feed.service'
import type { FeedEntryDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<FeedEntryDTO[]> => {
  await requireUser(event)
  return feedService.recentOpenings()
})
