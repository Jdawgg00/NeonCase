import { Prisma, type WalletTransactionType } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'
import { walletRepository } from '~~/server/repositories/wallet.repository'
import { auditLogRepository } from '~~/server/repositories/audit-log.repository'
import { AlreadyClaimedError, ConcurrencyError, InsufficientFundsError } from './errors'

const MAX_OPTIMISTIC_RETRIES = 5

export interface AdjustBalanceInput {
  userId: string
  /** Positive = credit, negative = debit. Always an integer — never a float. */
  amount: number
  type: WalletTransactionType
  idempotencyKey: string
  referenceType?: string
  referenceId?: string
  metadata?: Prisma.InputJsonValue
}

/**
 * One attempt, no retry — meant to be called from inside a `prisma.$transaction`
 * callback, possibly alongside other repository writes that must commit or
 * roll back together (e.g. a daily-claim row + the balance change, or a
 * case-opening + inventory item creation, or a market sale on both sides).
 * Throws InsufficientFundsError or ConcurrencyError; the caller decides
 * whether/how to retry the latter.
 */
export async function applyBalanceDeltaTx(tx: Prisma.TransactionClient, input: AdjustBalanceInput) {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error('amount må være et heltall som ikke er null')
  }

  const wallet = await walletRepository.findByUserId(input.userId, tx)
  if (!wallet) throw new Error(`Fant ingen wallet for bruker ${input.userId}`)

  const newBalance = wallet.balance + input.amount
  if (newBalance < 0) throw new InsufficientFundsError()

  const applied = await walletRepository.tryApplyDelta(wallet.id, wallet.version, newBalance, tx)
  if (!applied) throw new ConcurrencyError()

  const transaction = await walletRepository.recordTransaction(
    {
      walletId: wallet.id,
      type: input.type,
      amount: input.amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    tx,
  )

  return { transaction, balance: newBalance }
}

/** Retries on ConcurrencyError only. Never retries business-rule failures. */
export async function withOptimisticRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof ConcurrencyError && attempt < MAX_OPTIMISTIC_RETRIES - 1) continue
      throw err
    }
  }
  throw new ConcurrencyError('Kunne ikke oppdatere saldo etter flere forsøk')
}

export const walletService = {
  async getOrCreateWallet(userId: string) {
    const existing = await walletRepository.findByUserId(userId)
    if (existing) return existing

    const startingBalance = Number(process.env.STARTING_BALANCE ?? 10_000)
    return prisma.$transaction(async (tx) => {
      const again = await walletRepository.findByUserId(userId, tx)
      if (again) return again

      const wallet = await walletRepository.createForUser(userId, startingBalance, tx)
      await walletRepository.recordTransaction(
        {
          walletId: wallet.id,
          type: 'STARTING_BALANCE',
          amount: startingBalance,
          balanceBefore: 0,
          balanceAfter: startingBalance,
          referenceType: 'SIGNUP',
          referenceId: userId,
          idempotencyKey: `starting-balance:${userId}`,
        },
        tx,
      )
      return wallet
    })
  },

  async getTransactions(userId: string, opts: { cursor?: string; take?: number }) {
    const wallet = await this.getOrCreateWallet(userId)
    return walletRepository.listTransactions(wallet.id, { cursor: opts.cursor, take: opts.take ?? 20 })
  },

  /**
   * Public entry point for a standalone balance change (nothing else needs
   * to commit atomically alongside it). Handles idempotent replay and
   * optimistic-concurrency retries itself.
   */
  async adjustBalance(input: AdjustBalanceInput) {
    const existing = await walletRepository.findTransactionByIdempotencyKey(input.idempotencyKey)
    if (existing) return { transaction: existing, balance: existing.balanceAfter, replay: true }

    try {
      const result = await withOptimisticRetry(() => prisma.$transaction((tx) => applyBalanceDeltaTx(tx, input)))
      return { ...result, replay: false }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Lost an idempotency-key race to a concurrent identical request.
        const winner = await walletRepository.findTransactionByIdempotencyKey(input.idempotencyKey)
        if (winner) return { transaction: winner, balance: winner.balanceAfter, replay: true }
      }
      throw err
    }
  },

  /** One claim per user per calendar day (UTC), enforced by a DB unique constraint. */
  async claimDailyBonus(userId: string) {
    const rewardDate = new Date()
    rewardDate.setUTCHours(0, 0, 0, 0)
    const amount = Number(process.env.DAILY_BONUS_AMOUNT ?? 250)
    const idempotencyKey = `daily-bonus:${userId}:${rewardDate.toISOString().slice(0, 10)}`

    const alreadyClaimed = await walletRepository.hasClaimedOnDate(userId, rewardDate)
    if (alreadyClaimed) throw new AlreadyClaimedError('Daglig bonus er allerede hentet i dag')

    try {
      return await withOptimisticRetry(() =>
        prisma.$transaction(async (tx) => {
          await walletRepository.createDailyClaim(userId, rewardDate, amount, tx)
          const result = await applyBalanceDeltaTx(tx, {
            userId,
            amount,
            type: 'DAILY_BONUS',
            idempotencyKey,
            referenceType: 'DAILY_REWARD_CLAIM',
          })
          return result
        }),
      )
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AlreadyClaimedError('Daglig bonus er allerede hentet i dag')
      }
      throw err
    }
  },

  /**
   * Admin balance adjustment. `reason` is mandatory and always audit-logged
   * in the same transaction as the balance change — the two can never
   * happen without each other.
   */
  async adminAdjustBalance(input: { actorId: string; targetUserId: string; amount: number; reason: string; idempotencyKey: string }) {
    if (input.reason.trim().length < 10) {
      throw new Error('reason må forklare justeringen med minst 10 tegn')
    }

    const existing = await walletRepository.findTransactionByIdempotencyKey(input.idempotencyKey)
    if (existing) return { transaction: existing, balance: existing.balanceAfter, replay: true }

    return withOptimisticRetry(() =>
      prisma.$transaction(async (tx) => {
        const result = await applyBalanceDeltaTx(tx, {
          userId: input.targetUserId,
          amount: input.amount,
          type: input.amount >= 0 ? 'ADMIN_ADJUSTMENT_CREDIT' : 'ADMIN_ADJUSTMENT_DEBIT',
          idempotencyKey: input.idempotencyKey,
          referenceType: 'ADMIN_ADJUSTMENT',
        })
        await auditLogRepository.record(
          {
            actorId: input.actorId,
            targetId: input.targetUserId,
            action: 'ADMIN_WALLET_ADJUSTMENT',
            reason: input.reason,
            metadata: { amount: input.amount, transactionId: result.transaction.id },
          },
          tx,
        )
        return { ...result, replay: false }
      }),
    )
  },
}
