import { describe, expect, it } from 'vitest'
import { skinSeeds } from '../../prisma/seed-data/skins'
import { caseSeeds } from '../../prisma/seed-data/cases'
import { buildDropWeights, RARITY_WEIGHT_OUT_OF_10000 } from '~~/server/utils/case-odds'

describe('seed data integrity', () => {
  it('has at least 50 skins with the required rarity distribution', () => {
    expect(skinSeeds.length).toBeGreaterThanOrEqual(50)

    const counts: Record<string, number> = {}
    for (const s of skinSeeds) counts[s.rarity] = (counts[s.rarity] ?? 0) + 1

    expect(counts.COMMON).toBeGreaterThanOrEqual(20)
    expect(counts.UNCOMMON).toBeGreaterThanOrEqual(12)
    expect(counts.RARE).toBeGreaterThanOrEqual(8)
    expect(counts.EPIC).toBeGreaterThanOrEqual(6)
    expect(counts.SPECIAL).toBeGreaterThanOrEqual(4)

    // Every SPECIAL skin in this seed set is a blade — matches the spec's
    // "special blade-skins" requirement.
    for (const s of skinSeeds.filter((s) => s.rarity === 'SPECIAL')) {
      expect(s.weaponCategory).toBe('BLADES')
    }
  })

  it('has at least 5 cases, each with 10-100 skins from real slugs', () => {
    expect(caseSeeds.length).toBeGreaterThanOrEqual(5)
    const knownSlugs = new Set(skinSeeds.map((s) => s.slug))

    for (const c of caseSeeds) {
      expect(c.skinSlugs.length).toBeGreaterThanOrEqual(10)
      // The upper bound is generous on purpose — real cases carry the full
      // knife/glove finish pool (dozens of SPECIAL entries), not just one.
      expect(c.skinSlugs.length).toBeLessThanOrEqual(100)
      for (const slug of c.skinSlugs) {
        expect(knownSlugs.has(slug)).toBe(true)
      }
    }
  })

  it('produces drop weights that sum to exactly 10,000 for every case', () => {
    const skinBySlug = new Map(skinSeeds.map((s) => [s.slug, s]))

    for (const c of caseSeeds) {
      const skins = c.skinSlugs.map((slug) => {
        const skin = skinBySlug.get(slug)!
        return { slug, rarity: skin.rarity }
      })
      const weights = buildDropWeights(skins)
      const total = [...weights.values()].reduce((sum, w) => sum + w, 0)
      expect(total).toBe(10_000)
    }
  })

  it('the global rarity split itself sums to exactly 10,000', () => {
    const total = Object.values(RARITY_WEIGHT_OUT_OF_10000).reduce((sum, w) => sum + w, 0)
    expect(total).toBe(10_000)
  })
})
