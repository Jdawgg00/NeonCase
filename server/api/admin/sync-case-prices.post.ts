import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['ADMIN'])
  return adminService.syncCasePricesFromSeed(admin.id)
})
