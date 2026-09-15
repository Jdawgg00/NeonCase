import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { publishVersionSchema } from '~~/types/schemas/admin'
import { ValidationError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['ADMIN'])
  const caseId = getRouterParam(event, 'id')
  if (!caseId) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const parsed = publishVersionSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  try {
    const version = await adminService.publishNewVersion({ caseId, createdBy: admin.id, drops: parsed.data.drops })
    return { versionId: version.id, version: version.version, totalWeight: version.totalWeight }
  } catch (err) {
    if (err instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
})
