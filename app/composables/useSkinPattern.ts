/**
 * Deterministic, original "skin" look-and-feel — not real weapon art (which
 * would be Valve/CS2 copyrighted). Same seed always yields the same pattern,
 * so a given skin (or a specific owned instance via patternSeed) always
 * renders identically across reloads.
 */
export function useSkinPattern(seed: string | number, rarity: string) {
  const seedStr = String(seed)
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0
  }

  const hueShift = (hash % 41) - 20 // -20..+20deg — a per-skin tint on top of the rarity base color
  const angle = hash % 360
  const variant = hash % 3 // 0 = diagonal stripes, 1 = dots, 2 = radial sunburst

  const rarityVar = `var(--gc-${rarity.toLowerCase()})`
  const backgroundImage =
    variant === 0
      ? `repeating-linear-gradient(${angle}deg, color-mix(in srgb, ${rarityVar} 35%, transparent) 0px, color-mix(in srgb, ${rarityVar} 35%, transparent) 2px, transparent 2px, transparent 10px)`
      : variant === 1
        ? `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${rarityVar} 45%, transparent) 0px, color-mix(in srgb, ${rarityVar} 45%, transparent) 3px, transparent 3px)`
        : `radial-gradient(circle at ${30 + (hash % 40)}% ${30 + ((hash >> 4) % 40)}%, color-mix(in srgb, ${rarityVar} 50%, transparent), transparent 70%)`

  return {
    style: {
      backgroundImage,
      backgroundSize: variant === 1 ? '12px 12px' : variant === 0 ? undefined : undefined,
      filter: `hue-rotate(${hueShift}deg)`,
    } as Record<string, string | undefined>,
  }
}
