import { requireUser } from '~~/server/utils/require-auth'
import { socialService } from '~~/server/services/social.service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const notifications = await socialService.getNotifications(user.id)
  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }))
})
