import { prisma } from '~~/server/utils/prisma'
import { inventoryRepository } from '~~/server/repositories/inventory.repository'
import { marketRepository } from '~~/server/repositories/market.repository'
import { applyBalanceDeltaTx, withOptimisticRetry } from './wallet.service'
import { publishMarketEvent } from '~~/server/utils/market-events'
import { socialService } from './social.service'
import { CannotBuyOwnListingError, ItemNotAvailableError, ListingUnavailableError, NotOwnerError, ValidationError } from './errors'

const MARKET_FEE_BPS = Number(process.env.MARKET_FEE_BPS ?? 700) // basis points, 700 = 7.00%
// Quick-sell trades the wait for a real buyer for an instant, guaranteed
// sale — the 20% haircut is what makes listing on the market the better
// deal whenever there's time to wait for one.
const QUICK_SELL_RATE = 0.8

/**
 * The real Steam value in whole kr when we have one, otherwise the
 * internal, cosmetic baseReferenceValue (see schema.prisma) as a fallback
 * for skins with no successful Steam lookup yet.
 */
function referenceValueFor(skin: { baseReferenceValue: number; steamPriceCents: number | null }): number {
  return skin.steamPriceCents != null ? Math.round(skin.steamPriceCents / 100) : skin.baseReferenceValue
}

export const marketService = {
  async listItem(input: { sellerId: string; inventoryItemId: string; price: number }) {
    if (!Number.isInteger(input.price) || input.price <= 0) {
      throw new ValidationError('Pris må være et positivt heltall')
    }

    const item = await inventoryRepository.findById(input.inventoryItemId)
    if (!item) throw new ItemNotAvailableError('Fant ikke objektet')
    if (item.ownerId !== input.sellerId) throw new NotOwnerError()
    if (item.status !== 'AVAILABLE') throw new ItemNotAvailableError()

    return prisma.$transaction(async (tx) => {
      const transitioned = await inventoryRepository.tryTransitionStatus(item.id, 'AVAILABLE', 'LISTED', tx)
      if (!transitioned) throw new ItemNotAvailableError('Objektet ble nettopp låst eller listet av en annen handling')

      const listing = await marketRepository.createListing(
        { sellerId: input.sellerId, inventoryItemId: item.id, price: input.price, feeRate: MARKET_FEE_BPS },
        tx,
      )
      return listing
    }).then(async (listing) => {
      await publishMarketEvent({ type: 'listing_created', listingId: listing.id, skinName: '', price: listing.price })
      return listing
    })
  },

  async cancelListing(input: { sellerId: string; listingId: string }) {
    const listing = await marketRepository.findActiveById(input.listingId)
    if (!listing) throw new ListingUnavailableError('Annonsen finnes ikke eller er allerede avsluttet')
    if (listing.sellerId !== input.sellerId) throw new NotOwnerError()

    await prisma.$transaction(async (tx) => {
      const transitioned = await marketRepository.tryTransitionStatus(listing.id, 'CANCELLED', tx)
      if (!transitioned) throw new ListingUnavailableError('Noen kjøpte annonsen akkurat nå — kan ikke kansellere')
      await inventoryRepository.setStatus(listing.inventoryItemId, 'AVAILABLE', tx)
    })

    await publishMarketEvent({ type: 'listing_cancelled', listingId: listing.id })
  },

  /**
   * The atomic market-buy flow from spesifikasjonen (steps 1-16). Exactly
   * one concurrent buyer can succeed for a given listing — enforced by the
   * conditional ACTIVE -> SOLD update in marketRepository, not by an
   * application-level lock.
   */
  async buyListing(input: { buyerId: string; listingId: string; idempotencyKey: string }) {
    if (!input.idempotencyKey || input.idempotencyKey.length < 10) {
      throw new ValidationError('idempotencyKey mangler eller er for kort')
    }

    const existingSale = await prisma.marketSale.findFirst({
      where: { listingId: input.listingId, buyerId: input.buyerId },
    })
    // Idempotent replay guard for the common case; the real safety net is
    // the idempotencyKey inside applyBalanceDeltaTx below.
    if (existingSale) return { sale: existingSale, replay: true }

    const listing = await marketRepository.findActiveById(input.listingId)
    if (!listing) throw new ListingUnavailableError()
    if (listing.sellerId === input.buyerId) throw new CannotBuyOwnListingError()

    const feeAmount = Math.floor((listing.price * listing.feeRate) / 10_000)
    const sellerNetAmount = listing.price - feeAmount

    const sale = await withOptimisticRetry(() =>
      prisma.$transaction(async (tx) => {
        const transitioned = await marketRepository.tryTransitionStatus(listing.id, 'SOLD', tx)
        if (!transitioned) throw new ListingUnavailableError('En annen kjøper rakk denne annonsen først')

        // Buyer pays full price; seller receives price minus fee. The gap
        // (the fee) is never credited anywhere — it is removed from the
        // economy, exactly as spesifikasjonen requires.
        await applyBalanceDeltaTx(tx, {
          userId: input.buyerId,
          amount: -listing.price,
          type: 'MARKET_PURCHASE_DEBIT',
          idempotencyKey: `${input.idempotencyKey}:buyer-debit`,
          referenceType: 'MARKET_SALE',
          referenceId: listing.id,
        })
        await applyBalanceDeltaTx(tx, {
          userId: listing.sellerId,
          amount: sellerNetAmount,
          type: 'MARKET_SALE_CREDIT',
          idempotencyKey: `${input.idempotencyKey}:seller-credit`,
          referenceType: 'MARKET_SALE',
          referenceId: listing.id,
        })

        await inventoryRepository.transferOwnership(listing.inventoryItemId, input.buyerId, tx)

        return marketRepository.createSale(
          {
            listingId: listing.id,
            buyerId: input.buyerId,
            sellerId: listing.sellerId,
            grossAmount: listing.price,
            feeAmount,
            sellerNetAmount,
          },
          tx,
        )
      }),
    )

    await publishMarketEvent({ type: 'listing_sold', listingId: listing.id })

    try {
      const totalSales = await prisma.marketSale.count({ where: { sellerId: listing.sellerId } })
      await socialService.onMarketSale(listing.sellerId, totalSales, listing.price)
    } catch (err) {
      console.error('social hook failed after market sale (non-fatal):', err)
    }

    return { sale, replay: false }
  },

  /**
   * Sells straight back to the economy for QUICK_SELL_RATE of the skin's
   * reference value, no buyer required — for whenever the market has no one
   * looking to buy that particular item. The item isn't deleted (it can't
   * be: CaseOpening.inventoryItemId is a required FK to it) — it's moved to
   * the terminal SOLD status instead, same as a listing is never deleted,
   * only marked SOLD/CANCELLED.
   */
  async quickSell(input: { sellerId: string; inventoryItemId: string; idempotencyKey: string }) {
    if (!input.idempotencyKey || input.idempotencyKey.length < 10) {
      throw new ValidationError('idempotencyKey mangler eller er for kort')
    }

    const item = await inventoryRepository.findById(input.inventoryItemId)
    if (!item) throw new ItemNotAvailableError('Fant ikke objektet')
    if (item.ownerId !== input.sellerId) throw new NotOwnerError()
    if (item.status !== 'AVAILABLE') throw new ItemNotAvailableError()

    const price = Math.floor(referenceValueFor(item.skinDefinition) * QUICK_SELL_RATE)

    const { transaction } = await withOptimisticRetry(() =>
      prisma.$transaction(async (tx) => {
        const transitioned = await inventoryRepository.tryTransitionStatus(item.id, 'AVAILABLE', 'SOLD', tx)
        if (!transitioned) throw new ItemNotAvailableError('Objektet ble nettopp låst eller listet av en annen handling')

        return applyBalanceDeltaTx(tx, {
          userId: input.sellerId,
          amount: price,
          type: 'QUICK_SELL_CREDIT',
          idempotencyKey: input.idempotencyKey,
          referenceType: 'INVENTORY_ITEM',
          referenceId: item.id,
        })
      }),
    )

    return { price, balance: transaction.balanceAfter }
  },

  search(filter: Parameters<typeof marketRepository.search>[0]) {
    return marketRepository.search(filter)
  },

  mySellerListings(sellerId: string) {
    return marketRepository.listBySeller(sellerId)
  },

  priceHistory(skinDefinitionId: string) {
    return marketRepository.recentSalesForSkin(skinDefinitionId)
  },
}
