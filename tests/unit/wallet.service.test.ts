import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'
import { walletService } from '~~/server/services/wallet.service'
import { AlreadyClaimedError, InsufficientFundsError } from '~~/server/services/errors'

// These tests hit a real Postgres instance (they exercise optimistic
// concurrency and unique constraints, which a mock can't meaningfully
// verify). Point DATABASE_URL at a disposable test database before running
// `npm run test` — e.g. the one from `docker compose up -d`.
const prisma = new PrismaClient()

async function createTestUser(startingBalance = 1_000) {
  const user = await prisma.user.create({
    data: {
      email: `test-${nanoid()}@neoncrate.local`,
      username: `test-${nanoid(8)}`,
      wallet: { create: { balance: startingBalance } },
    },
  })
  return user
}

describe('walletService', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('never lets balance go negative', async () => {
    const user = await createTestUser(100)

    await expect(
      walletService.adjustBalance({
        userId: user.id,
        amount: -150,
        type: 'CASE_PURCHASE',
        idempotencyKey: nanoid(),
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError)

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    expect(wallet?.balance).toBe(100) // unchanged
  })

  it('applies the same idempotency key only once', async () => {
    const user = await createTestUser(1_000)
    const idempotencyKey = nanoid()

    const first = await walletService.adjustBalance({
      userId: user.id,
      amount: -200,
      type: 'CASE_PURCHASE',
      idempotencyKey,
    })
    const second = await walletService.adjustBalance({
      userId: user.id,
      amount: -200,
      type: 'CASE_PURCHASE',
      idempotencyKey, // same key, would double-charge if not idempotent
    })

    expect(first.replay).toBe(false)
    expect(second.replay).toBe(true)

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    expect(wallet?.balance).toBe(800) // only debited once
  })

  it('only allows one daily bonus claim per calendar day', async () => {
    const user = await createTestUser(0)

    const first = await walletService.claimDailyBonus(user.id)
    expect(first.balance).toBeGreaterThan(0)

    await expect(walletService.claimDailyBonus(user.id)).rejects.toBeInstanceOf(AlreadyClaimedError)

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    expect(wallet?.balance).toBe(first.balance) // second claim did not add more
  })

  it('keeps balance consistent under concurrent debits (optimistic concurrency)', async () => {
    const user = await createTestUser(1_000)

    // Ten concurrent debits of 150 each. Balance only supports six (900),
    // so exactly some succeed and the rest fail — but the sum must never
    // push balance negative, and no debit should be silently lost or
    // double-applied.
    const attempts = Array.from({ length: 10 }, () =>
      walletService.adjustBalance({
        userId: user.id,
        amount: -150,
        type: 'CASE_PURCHASE',
        idempotencyKey: nanoid(),
      }).then(
        () => 'ok' as const,
        (err) => (err instanceof InsufficientFundsError ? ('rejected' as const) : Promise.reject(err)),
      ),
    )

    const results = await Promise.all(attempts)
    const succeeded = results.filter((r) => r === 'ok').length

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    expect(wallet?.balance).toBe(1_000 - succeeded * 150)
    expect(wallet!.balance).toBeGreaterThanOrEqual(0)
  })
})
