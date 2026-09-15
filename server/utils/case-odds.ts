import type { Rarity } from '@prisma/client'

/** Exact global rarity split from spesifikasjonen — must sum to 10 000 (= 100.00%). */
export const RARITY_WEIGHT_OUT_OF_10000: Record<Rarity, number> = {
  COMMON: 7992,
  UNCOMMON: 1598,
  RARE: 320,
  EPIC: 64,
  SPECIAL: 26,
}

/**
 * Splits each rarity tier's total weight evenly across however many skins
 * of that rarity are in a given case, putting any remainder on the first
 * skin in the tier so the sum is always exactly 10 000 — never a rounding
 * error away from 100%. Pure function — same output for the same input,
 * every time, which is what makes case-version odds auditable.
 */
export function buildDropWeights(skins: { slug: string; rarity: Rarity }[]): Map<string, number> {
  const byRarity = new Map<Rarity, string[]>()
  for (const s of skins) {
    byRarity.set(s.rarity, [...(byRarity.get(s.rarity) ?? []), s.slug])
  }

  const weights = new Map<string, number>()
  for (const [rarity, slugs] of byRarity) {
    const total = RARITY_WEIGHT_OUT_OF_10000[rarity]
    const base = Math.floor(total / slugs.length)
    const remainder = total - base * slugs.length
    slugs.forEach((slug, i) => weights.set(slug, base + (i === 0 ? remainder : 0)))
  }
  return weights
}
