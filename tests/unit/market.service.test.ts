import { afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'
import { marketService } from '~~/server/services/market.service'
import { CannotBuyOwnListingError, ItemNotAvailableError } from '~~/server/services/errors'

// DB-backed for the same reason as wallet.service.test.ts — concurrency
// guarantees can't be meaningfully verified with mocks. Point DATABASE_URL
// at a disposable database before running `npm run test`.
const prisma = new PrismaClient()

async function createUserWithItem(opts: { balance?: number; skinValue?: number } = {}) {
  const skin = await prisma.skinDefinition.create({
    data: {
      slug: `test-skin-${nanoid(8)}`,
      name: `Test Skin ${nanoid(4)}`,
      weaponCategory: 'RIFLES',
      rarity: 'RARE',
      baseReferenceValue: opts.skinValue ?? 500,
    },
  })
  const user = await prisma.user.create({
    data: {
      email: `test-${nanoid()}@neoncrate.local`,
      username: `test-${nanoid(8)}`,
      wallet: { create: { balance: opts.balance ?? 1_000 } },
    },
  })
  const item = await prisma.inventoryItem.create({
    data: {
      ownerId: user.id,
      skinDefinitionId: skin.id,
      sourceType: 'ADMIN_GRANT',
      floatValue: 0.1,
      wear: 'FIELD_TESTED',
      patternSeed: 1,
    },
  })
  return { user, item, skin }
}

describe('marketService', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('will not list an item that is already listed', async () => {
    const { user, item } = await createUserWithItem()
    await marketService.listItem({ sellerId: user.id, inventoryItemId: item.id, price: 100 })

    await expect(marketService.listItem({ sellerId: user.id, inventoryItemId: item.id, price: 150 })).rejects.toBeInstanceOf(
      ItemNotAvailableError,
    )
  })

  it('rejects buying your own listing', async () => {
    const { user, item } = await createUserWithItem()
    const listing = await marketService.listItem({ sellerId: user.id, inventoryItemId: item.id, price: 100 })

    await expect(
      marketService.buyListing({ buyerId: user.id, listingId: listing.id, idempotencyKey: nanoid() }),
    ).rejects.toBeInstanceOf(CannotBuyOwnListingError)
  })

  it('transfers the correct net amount to the seller and removes the fee from the economy', async () => {
    const { user: seller, item } = await createUserWithItem()
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${nanoid()}@neoncrate.local`,
        username: `buyer-${nanoid(8)}`,
        wallet: { create: { balance: 1_000 } },
      },
    })

    const listing = await marketService.listItem({ sellerId: seller.id, inventoryItemId: item.id, price: 1_000 })
    await marketService.buyListing({ buyerId: buyer.id, listingId: listing.id, idempotencyKey: nanoid() })

    const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyer.id } })
    const sellerWallet = await prisma.wallet.findUnique({ where: { userId: seller.id } })
    const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: item.id } })

    const expectedFee = Math.floor((1_000 * 700) / 10_000) // 7% of 1000 = 70
    expect(buyerWallet?.balance).toBe(1_000 - 1_000) // paid full price
    expect(sellerWallet?.balance).toBe(1_000 + (1_000 - expectedFee)) // received price minus fee
    expect(updatedItem?.ownerId).toBe(buyer.id)
    expect(updatedItem?.status).toBe('AVAILABLE')

    // Total credits in the two wallets dropped by exactly the fee — it went
    // nowhere else, matching "avgiften fjernes fra økonomien".
    const totalBefore = 1_000 + 1_000
    const totalAfter = (buyerWallet?.balance ?? 0) + (sellerWallet?.balance ?? 0)
    expect(totalBefore - totalAfter).toBe(expectedFee)
  })

  it('lets only one concurrent buyer win the same listing', async () => {
    const { user: seller, item } = await createUserWithItem()
    const buyers = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: {
            email: `buyer${i}-${nanoid()}@neoncrate.local`,
            username: `buyer${i}-${nanoid(6)}`,
            wallet: { create: { balance: 1_000 } },
          },
        }),
      ),
    )

    const listing = await marketService.listItem({ sellerId: seller.id, inventoryItemId: item.id, price: 100 })

    const results = await Promise.allSettled(
      buyers.map((b) => marketService.buyListing({ buyerId: b.id, listingId: listing.id, idempotencyKey: nanoid() })),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled')
    expect(succeeded).toHaveLength(1)

    const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: item.id } })
    expect(buyers.map((b) => b.id)).toContain(updatedItem?.ownerId)
  })
})
