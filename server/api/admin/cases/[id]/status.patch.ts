import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { setCaseStatusSchema } from '~~/types/schemas/admin'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const caseId = getRouterParam(event, 'id')
  if (!caseId) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const parsed = setCaseStatusSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Ugyldig input' })

  const updated = await adminService.setCaseStatus(caseId, parsed.data.status)
  return { id: updated.id, status: updated.status }
})
