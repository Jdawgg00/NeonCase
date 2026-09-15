import { redis } from './redis'

export const MARKET_EVENTS_CHANNEL = 'neoncrate:market-events'

export type MarketEvent =
  | { type: 'listing_created'; listingId: string; skinName: string; price: number }
  | { type: 'listing_sold'; listingId: string }
  | { type: 'listing_cancelled'; listingId: string }

/**
 * Best-effort live-update broadcast — the listing/sale/cancellation this
 * announces has already committed to Postgres by the time this is called.
 * Redis being unavailable should cost other players a live refresh, never
 * the economic action itself or the response the caller is waiting on
 * (unguarded, this previously surfaced as a 500 on a listing that had, in
 * fact, already succeeded).
 */
export async function publishMarketEvent(event: MarketEvent) {
  try {
    await redis.publish(MARKET_EVENTS_CHANNEL, JSON.stringify(event))
  } catch (err) {
    console.error('publishMarketEvent failed (non-fatal):', err)
  }
}
