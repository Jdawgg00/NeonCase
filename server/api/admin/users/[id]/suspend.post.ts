import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { suspendUserSchema } from '~~/types/schemas/admin'
import { ValidationError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['ADMIN'])
  const targetUserId = getRouterParam(event, 'id')
  if (!targetUserId) throw createError({ statusCode: 400, statusMessage: 'Mangler id' })

  const parsed = suspendUserSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  try {
    const user = await adminService.suspendUser({
      actorId: admin.id,
      targetUserId,
      status: parsed.data.status,
      reason: parsed.data.reason,
    })
    return { id: user.id, status: user.status }
  } catch (err) {
    if (err instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
})
