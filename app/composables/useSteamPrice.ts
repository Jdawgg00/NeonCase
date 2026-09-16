/** Formats the display-only Steam Community Market reference price. Returns null until the first background refresh has run for that skin. */
export function formatSteamPrice(cents: number | null, currency: string | null): string | null {
  if (cents == null) return null
  return (cents / 100).toLocaleString('nb-NO', { style: 'currency', currency: currency ?? 'NOK' })
}

/**
 * Real Steam price when we have one, otherwise a labeled estimate derived
 * from the skin's internal reference value — never silently presented as a
 * real Steam price, since baseReferenceValue is cosmetic (see
 * schema.prisma), not a real-world figure.
 */
export function priceOrEstimate(
  cents: number | null,
  currency: string | null,
  baseReferenceValue: number,
): { text: string; estimated: boolean } {
  const real = formatSteamPrice(cents, currency)
  if (real) return { text: real, estimated: false }
  return { text: formatKr(baseReferenceValue), estimated: true }
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
