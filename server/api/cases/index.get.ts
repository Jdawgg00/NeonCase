import { requireUser } from '~~/server/utils/require-auth'
import { caseService } from '~~/server/services/case.service'
import { toCaseSummaryDTO, type CaseSummaryDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<CaseSummaryDTO[]> => {
  await requireUser(event) // internal, employees-only catalog — not public marketing
  const cases = await caseService.getActiveCases()
  return cases.map(toCaseSummaryDTO)
})
