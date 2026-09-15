import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const query = getQuery(event)
  const entries = await adminService.auditLog(Math.min(Number(query.take) || 50, 200))

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    actor: e.actor?.username ?? null,
    target: e.target?.username ?? null,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  }))
})
