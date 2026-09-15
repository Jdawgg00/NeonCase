import { requireUser } from '~~/server/utils/require-auth'
import { caseService, CaseNotAvailableError } from '~~/server/services/case.service'
import { toCaseDetailDTO, type CaseDetailDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<CaseDetailDTO> => {
  await requireUser(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Mangler slug' })

  try {
    const { caseDefinition, version } = await caseService.getCaseDetail(slug)
    return toCaseDetailDTO(caseDefinition, version)
  } catch (err) {
    if (err instanceof CaseNotAvailableError) {
      throw createError({ statusCode: 404, statusMessage: err.message })
    }
    throw err
  }
})
