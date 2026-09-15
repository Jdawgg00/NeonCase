import { requireRole } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { walletService } from '~~/server/services/wallet.service'
import { adminWalletAdjustmentSchema } from '~~/types/schemas/wallet'
import { InsufficientFundsError } from '~~/server/services/errors'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['ADMIN'])

  const withinLimit = await checkRateLimit(`admin-adjustment:${admin.id}`, 20, 60)
  if (!withinLimit) {
    throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })
  }

  const parsed = adminWalletAdjustmentSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Ugyldig input' })
  }
  const body = parsed.data

  try {
    const result = await walletService.adminAdjustBalance({
      actorId: admin.id,
      targetUserId: body.targetUserId,
      amount: body.amount,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
    })
    return { balance: result.balance, replay: result.replay }
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      throw createError({ statusCode: 400, statusMessage: 'Justeringen ville gitt negativ saldo' })
    }
    throw err
  }
})
