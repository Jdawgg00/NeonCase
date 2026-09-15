import { requireUser } from '~~/server/utils/require-auth'
import { checkRateLimit } from '~~/server/utils/redis'
import { walletService } from '~~/server/services/wallet.service'
import { AlreadyClaimedError } from '~~/server/services/errors'
import type { WalletDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<WalletDTO> => {
  const user = await requireUser(event)

  // Generous limit — the DB constraint is the real guard, this just stops
  // someone hammering the endpoint.
  const withinLimit = await checkRateLimit(`daily-bonus:${user.id}`, 5, 60)
  if (!withinLimit) {
    throw createError({ statusCode: 429, statusMessage: 'For mange forsøk, prøv igjen om litt' })
  }

  try {
    const result = await walletService.claimDailyBonus(user.id)
    return { balance: result.balance }
  } catch (err) {
    if (err instanceof AlreadyClaimedError) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    throw err
  }
})
