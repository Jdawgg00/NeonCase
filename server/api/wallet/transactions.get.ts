import { requireUser } from '~~/server/utils/require-auth'
import { walletService } from '~~/server/services/wallet.service'
import { toWalletTransactionDTO, type WalletTransactionDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<WalletTransactionDTO[]> => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined
  const take = Math.min(Number(query.take) || 20, 50) // hard ceiling — no unbounded fetches

  const transactions = await walletService.getTransactions(user.id, { cursor, take })
  return transactions.map(toWalletTransactionDTO)
})
