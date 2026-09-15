import { randomInt } from 'node:crypto'
import type { Wear } from '@prisma/client'

export interface WeightedDrop {
  skinDefinitionId: string
  weight: number
}

/**
 * Cryptographically secure weighted selection over integer weights.
 * Never use Math.random() for anything that affects a drop — node:crypto's
 * randomInt is CSPRNG-backed and this is the one place in the app that
 * decides what a player receives.
 *
 * `totalWeight` must equal the exact sum of `drops[].weight` (validated at
 * case-version publish time) — this function trusts that invariant rather
 * than re-summing on every roll.
 */
export function selectWeightedDrop(drops: WeightedDrop[], totalWeight: number): { skinDefinitionId: string; roll: number } {
  if (drops.length === 0) throw new Error('Ingen drops tilgjengelig for denne case-versjonen')
  if (!Number.isInteger(totalWeight) || totalWeight <= 0) throw new Error('totalWeight må være et positivt heltall')

  const roll = randomInt(0, totalWeight) // uniform integer in [0, totalWeight)
  let cumulative = 0
  for (const drop of drops) {
    cumulative += drop.weight
    if (roll < cumulative) {
      return { skinDefinitionId: drop.skinDefinitionId, roll }
    }
  }
  // Unreachable if totalWeight really is sum(weights). Fail loudly instead
  // of silently handing out the last item in the list.
  throw new Error('Vekttabellen summerer ikke til totalWeight — case-versjonen er korrupt')
}

const FLOAT_PRECISION = 1_000_000

/** Uniform float in [minFloat, maxFloat], rounded to 6 decimals, CSPRNG-backed. */
export function generateFloatValue(minFloat: number, maxFloat: number): number {
  const range = Math.round((maxFloat - minFloat) * FLOAT_PRECISION)
  const raw = randomInt(0, range + 1)
  return Math.round((minFloat * FLOAT_PRECISION + raw)) / FLOAT_PRECISION
}

export function wearFromFloat(floatValue: number): Wear {
  if (floatValue <= 0.07) return 'PRISTINE'
  if (floatValue <= 0.15) return 'LIGHTLY_USED'
  if (floatValue <= 0.38) return 'FIELD_TESTED'
  if (floatValue <= 0.45) return 'WORN'
  return 'BATTLE_SCARRED'
}

/** Cosmetic-only seed (pattern look) — not economically sensitive, but still CSPRNG for consistency. */
export function generatePatternSeed(): number {
  return randomInt(0, 1_000_000)
}
