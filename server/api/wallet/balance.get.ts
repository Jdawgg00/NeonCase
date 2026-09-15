import { requireUser } from '~~/server/utils/require-auth'
import { walletService } from '~~/server/services/wallet.service'
import type { WalletDTO } from '~~/types/dto'

export default defineEventHandler(async (event): Promise<WalletDTO> => {
  const user = await requireUser(event)
  const wallet = await walletService.getOrCreateWallet(user.id)
  return { balance: wallet.balance }
})
