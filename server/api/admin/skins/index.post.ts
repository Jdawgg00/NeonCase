import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { createSkinSchema } from '~~/types/schemas/admin'
import { toSkinDTO } from '~~/types/dto'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = createSkinSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  const skin = await adminService.createSkin(parsed.data)
  return toSkinDTO(skin)
})
