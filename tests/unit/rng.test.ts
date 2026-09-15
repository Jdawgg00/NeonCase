import { describe, expect, it } from 'vitest'
import { selectWeightedDrop } from '~~/server/utils/rng'

describe('selectWeightedDrop', () => {
  it('throws on an empty or invalid weight table instead of silently picking something', () => {
    expect(() => selectWeightedDrop([], 100)).toThrow()
    expect(() => selectWeightedDrop([{ skinDefinitionId: 'X', weight: 10 }], 0)).toThrow()
  })

  it(
    'matches the configured odds within tolerance over 1,000,000 draws',
    () => {
    // Exact rarity split from spesifikasjonen: 79.92 / 15.98 / 3.20 / 0.64 / 0.26 %
    const drops = [
      { skinDefinitionId: 'COMMON', weight: 7992 },
      { skinDefinitionId: 'UNCOMMON', weight: 1598 },
      { skinDefinitionId: 'RARE', weight: 320 },
      { skinDefinitionId: 'EPIC', weight: 64 },
      { skinDefinitionId: 'SPECIAL', weight: 26 },
    ]
    const totalWeight = drops.reduce((sum, d) => sum + d.weight, 0)
    expect(totalWeight).toBe(10_000)

    const ITERATIONS = 1_000_000
    const counts: Record<string, number> = {}
    for (let i = 0; i < ITERATIONS; i++) {
      const { skinDefinitionId, roll } = selectWeightedDrop(drops, totalWeight)
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(totalWeight)
      counts[skinDefinitionId] = (counts[skinDefinitionId] ?? 0) + 1
    }

    for (const drop of drops) {
      const expected = (drop.weight / totalWeight) * ITERATIONS
      const observed = counts[drop.skinDefinitionId] ?? 0
      // ~8 standard deviations of slack even on the rarest tier — generous
      // enough to avoid flakiness, tight enough to catch a real bug (wrong
      // cumulative logic, Math.random() substitution, swapped weights).
      const tolerance = Math.max(expected * 0.08, 200)
      expect(Math.abs(observed - expected)).toBeLessThan(tolerance)
    }
    },
    30_000,
  )
})
