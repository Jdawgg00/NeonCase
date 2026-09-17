/**
 * Doppler-family knives get a cosmetic "phase" in real CS2 (Phase 1-4, plus
 * rare Ruby/Sapphire/Black Pearl for Doppler and Emerald for Gamma Doppler),
 * determined by the specific finish pattern. This app doesn't model finish
 * patterns for real, but patternSeed is already a uniform random number
 * generated once per item and stored forever — reusing it here to pick a
 * phase deterministically means every re-render of the same item always
 * shows the same phase, with no schema change or extra stored state needed.
 * Approximate real-world phase odds, for flavor only — not economic.
 */
interface PhaseWeight {
  name: string
  weight: number
}

const DOPPLER_PHASES: PhaseWeight[] = [
  { name: 'Phase 1', weight: 2379 },
  { name: 'Phase 2', weight: 2058 },
  { name: 'Phase 3', weight: 1553 },
  { name: 'Phase 4', weight: 2864 },
  { name: 'Ruby', weight: 517 },
  { name: 'Sapphire', weight: 517 },
  { name: 'Black Pearl', weight: 112 },
]

const GAMMA_DOPPLER_PHASES: PhaseWeight[] = [
  { name: 'Phase 1', weight: 2000 },
  { name: 'Phase 2', weight: 2000 },
  { name: 'Phase 3', weight: 2000 },
  { name: 'Phase 4', weight: 3500 },
  { name: 'Emerald', weight: 500 },
]

function pickPhase(seed: number, phases: PhaseWeight[]): string {
  const total = phases.reduce((sum, p) => sum + p.weight, 0)
  let roll = seed % total
  for (const p of phases) {
    if (roll < p.weight) return p.name
    roll -= p.weight
  }
  return phases[phases.length - 1]!.name
}

export function dopplerPhaseFor(skinName: string, patternSeed: number): string | null {
  // Check "Gamma Doppler" first: it also contains the substring "Doppler".
  if (skinName.includes('Gamma Doppler')) return pickPhase(patternSeed, GAMMA_DOPPLER_PHASES)
  if (skinName.includes('Doppler')) return pickPhase(patternSeed, DOPPLER_PHASES)
  return null
}
