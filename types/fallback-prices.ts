/**
 * Small, deliberately low quick-sell/listing-suggestion values for a skin
 * with no successful Steam lookup yet — baseReferenceValue (an internal,
 * cosmetic rarity-tier number, see schema.prisma) produced absurd real-kr
 * figures like 172 kr for a skin actually worth ~5 kr. These are real-world
 * ballpark guesses instead, only ever used until the real Steam price comes
 * in. Shared between client (listing-price suggestion) and server
 * (quick-sell payout) so the two never disagree.
 */
export const FALLBACK_VALUE_BY_RARITY: Record<string, number> = {
  COMMON: 1,
  UNCOMMON: 5,
  RARE: 15,
  EPIC: 50,
  SPECIAL: 200,
}

export function fallbackValueForRarity(rarity: string): number {
  return FALLBACK_VALUE_BY_RARITY[rarity] ?? FALLBACK_VALUE_BY_RARITY.COMMON!
}
