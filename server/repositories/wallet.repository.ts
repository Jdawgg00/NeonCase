import type { Prisma, WalletTransactionType } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export interface RecordTransactionInput {
  walletId: string
  type: WalletTransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceType?: string
  referenceId?: string
  idempotencyKey: string
  metadata?: Prisma.InputJsonValue
}

export const walletRepository = {
  findByUserId(userId: string, db: Db = prisma) {
    return db.wallet.findUnique({ where: { userId } })
  },

  createForUser(userId: string, startingBalance: number, db: Db = prisma) {
    return db.wallet.create({ data: { userId, balance: startingBalance } })
  },

  findTransactionByIdempotencyKey(idempotencyKey: string, db: Db = prisma) {
    return db.walletTransaction.findUnique({ where: { idempotencyKey } })
  },

  /**
   * Optimistic-concurrency write: only succeeds if `version` still matches
   * what the caller last read. Returns false (never throws) when another
   * writer got there first, so the service layer can decide to retry.
   */
  async tryApplyDelta(walletId: string, expectedVersion: number, newBalance: number, db: Db = prisma) {
    const result = await db.wallet.updateMany({
      where: { id: walletId, version: expectedVersion },
      data: { balance: newBalance, version: { increment: 1 } },
    })
    return result.count === 1
  },

  recordTransaction(input: RecordTransactionInput, db: Db = prisma) {
    return db.walletTransaction.create({ data: input })
  },

  listTransactions(walletId: string, opts: { cursor?: string; take: number }, db: Db = prisma) {
    return db.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    })
  },

  hasClaimedOnDate(userId: string, rewardDate: Date, db: Db = prisma) {
    return db.dailyRewardClaim.findUnique({
      where: { userId_rewardDate: { userId, rewardDate } },
    })
  },

  createDailyClaim(userId: string, rewardDate: Date, amount: number, db: Db = prisma) {
    return db.dailyRewardClaim.create({ data: { userId, rewardDate, amount } })
  },
}
