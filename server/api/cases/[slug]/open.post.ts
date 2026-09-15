import { requireUser } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { caseService, CaseNotAvailableError } from '~~/server/services/case.service'
import { openCaseSchema } from '~~/types/schemas/case'
import { InsufficientFundsError, ValidationError } from '~~/server/services/errors'
import { toCaseOpeningResultDTO, type CaseOpeningResultDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<CaseOpeningResultDTO> => {
  const user = await requireUser(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Mangler slug' })

  // Prevents double-click / rapid parallel opens from the same user, on top
  // of the idempotency-key protection inside the service itself.
  const withinLimit = await checkRateLimit(`case-open:${user.id}`, 10, 10)
  if (!withinLimit) {
    throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })
  }

  const parsed = openCaseSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }

  try {
    const { opening, replay } = await caseService.openCase({
      userId: user.id,
      caseSlug: slug,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return toCaseOpeningResultDTO(opening, replay)
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      throw createError({ statusCode: 400, statusMessage: 'Ikke nok credits til å åpne denne casen' })
    }
    if (err instanceof CaseNotAvailableError) {
      throw createError({ statusCode: 404, statusMessage: err.message })
    }
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, statusMessage: err.message })
    }
    throw err
  }
})
