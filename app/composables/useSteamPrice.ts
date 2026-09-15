/** Formats the display-only Steam Community Market reference price. Returns null until the first background refresh has run for that skin. */
export function formatSteamPrice(cents: number | null, currency: string | null): string | null {
  if (cents == null) return null
  return (cents / 100).toLocaleString('nb-NO', { style: 'currency', currency: currency ?? 'NOK' })
}

/**
 * Formats the app's own virtual balance/prices (wallet, case prices, market
 * listings) — whole kr, not real money. Named separately from
 * formatSteamPrice because the two track different things in different
 * units (this is whole kr; Steam prices are stored in øre).
 */
export function formatKr(amount: number): string {
  return `${amount.toLocaleString('nb-NO')} kr`
}
