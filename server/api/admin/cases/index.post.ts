import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { createCaseSchema } from '~~/types/schemas/admin'
import { toCaseSummaryDTO } from '~~/types/dto'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = createCaseSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  const caseDefinition = await adminService.createCase(parsed.data)
  return toCaseSummaryDTO(caseDefinition)
})
