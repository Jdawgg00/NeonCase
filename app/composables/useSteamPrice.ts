/** Formats the display-only Steam Community Market reference price. Returns null until the first background refresh has run for that skin. */
export function formatSteamPrice(cents: number | null, currency: string | null): string | null {
  if (cents == null) return null
  return (cents / 100).toLocaleString('nb-NO', { style: 'currency', currency: currency ?? 'NOK' })
}

/**
 * Real Steam price when we have one, otherwise "Ukjent" — showing a
 * fabricated number here (as an earlier version did, derived from the
 * skin's cosmetic baseReferenceValue) produced absurd figures like 250 kr
 * for a skin actually worth 3 kr. No number is better than a wrong one.
 */
export function displaySteamPrice(cents: number | null, currency: string | null): string {
  return formatSteamPrice(cents, currency) ?? 'Ukjent'
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
