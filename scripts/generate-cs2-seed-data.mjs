// One-off generator: reads the cached ByMykel/CSGO-API case dump and produces
// prisma/seed-data/skins.ts + prisma/seed-data/cases.ts with real CS2 names,
// rarities and Steam CDN image URLs. Not part of the app runtime.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const raw = JSON.parse(readFileSync(join(root, 'prisma/seed-data/cs2-source-data.json'), 'utf8').replace(/^﻿/, ''))

const RARITY_MAP = {
  'Mil-Spec Grade': 'COMMON',
  Restricted: 'UNCOMMON',
  Classified: 'RARE',
  Covert: 'EPIC',
}

const CATEGORY_BY_WEAPON = {
  'AK-47': 'RIFLES', 'M4A4': 'RIFLES', 'M4A1-S': 'RIFLES', 'AUG': 'RIFLES',
  'SG 553': 'RIFLES', 'FAMAS': 'RIFLES', 'Galil AR': 'RIFLES',
  'AWP': 'PRECISION', 'SSG 08': 'PRECISION', 'G3SG1': 'PRECISION', 'SCAR-20': 'PRECISION',
  'Glock-18': 'SIDEARMS', 'USP-S': 'SIDEARMS', 'P250': 'SIDEARMS', 'Desert Eagle': 'SIDEARMS',
  'Tec-9': 'SIDEARMS', 'Five-SeveN': 'SIDEARMS', 'CZ75-Auto': 'SIDEARMS',
  'Dual Berettas': 'SIDEARMS', 'R8 Revolver': 'SIDEARMS', 'P2000': 'SIDEARMS', 'Zeus x27': 'SIDEARMS',
  'MP9': 'COMPACT', 'MAC-10': 'COMPACT', 'MP7': 'COMPACT', 'MP5-SD': 'COMPACT',
  'UMP-45': 'COMPACT', 'P90': 'COMPACT', 'PP-Bizon': 'COMPACT',
  'Nova': 'HEAVY', 'XM1014': 'HEAVY', 'Sawed-Off': 'HEAVY', 'MAG-7': 'HEAVY',
  'M249': 'HEAVY', 'Negev': 'HEAVY',
}

const VALUE_RANGE = {
  COMMON: [60, 95],
  UNCOMMON: [180, 250],
  RARE: [550, 720],
  EPIC: [1400, 1700],
  SPECIAL: [5000, 7000],
}

function q(str) {
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function categoryFor(name) {
  const weapon = name.split(' | ')[0].trim()
  return CATEGORY_BY_WEAPON[weapon] ?? null
}

const valueCounters = { COMMON: 0, UNCOMMON: 0, RARE: 0, EPIC: 0, SPECIAL: 0 }
function nextValue(rarity) {
  const [min, max] = VALUE_RANGE[rarity]
  const n = valueCounters[rarity]++
  const step = (max - min) / 8
  return Math.round(min + (n % 9) * step)
}

// Real per-skin float caps (min/max wear range) — not present in the crates
// dump, so pulled from a second open dataset and merged in by name.
const floatCapsRes = await fetch('https://raw.githubusercontent.com/qwkdev/csapi/main/data.json')
const floatCapsData = await floatCapsRes.json()
const floatCapsByName = new Map(
  Object.values(floatCapsData).map((entry) => [entry.name, entry['float-caps']]),
)

const skinsBySlug = new Map()
const caseSeeds = []

for (const c of raw) {
  const skinSlugs = []

  for (const item of c.contains) {
    const rarity = RARITY_MAP[item.rarity]
    const category = categoryFor(item.name)
    if (!rarity || !category) throw new Error(`No mapping for ${item.name} (${item.rarity})`)
    const slug = slugify(item.name)
    skinSlugs.push(slug)
    if (!skinsBySlug.has(slug)) {
      const [minFloat, maxFloat] = floatCapsByName.get(item.name) ?? [0, 1]
      skinsBySlug.set(slug, {
        slug,
        name: item.name,
        weaponCategory: category,
        rarity,
        baseReferenceValue: nextValue(rarity),
        minFloat,
        maxFloat,
        imageUrl: item.image,
      })
    }
  }

  // All real knife/glove finishes for this case — not just one placeholder.
  for (const special of c.specialItems) {
    const specialSlug = slugify(special.name)
    skinSlugs.push(specialSlug)
    if (!skinsBySlug.has(specialSlug)) {
      const [minFloat, maxFloat] = floatCapsByName.get(special.name) ?? [0, 1]
      skinsBySlug.set(specialSlug, {
        slug: specialSlug,
        name: special.name,
        weaponCategory: 'BLADES',
        rarity: 'SPECIAL',
        baseReferenceValue: nextValue('SPECIAL'),
        minFloat,
        maxFloat,
        imageUrl: special.image,
      })
    }
  }

  caseSeeds.push({
    slug: slugify(c.name),
    name: c.name,
    imageUrl: c.image,
    skinSlugs,
  })
}

const CASE_META = {
  'danger-zone-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Danger Zone Case-lineup, hentet direkte fra CS2 sitt droptabell-arkiv.' },
  'prisma-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Prisma Case-lineup — samme skins som i det offisielle spillet.' },
  'shattered-web-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Shattered Web Case-lineup, inkludert Nomad Knife.' },
  'horizon-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Horizon Case-lineup fra CS2.' },
  'clutch-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Clutch Case-lineup, inkludert Driver Gloves.' },
  'falchion-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Falchion Case-lineup, inkludert Falchion Knife.' },
  'chroma-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Chroma Case-lineup fra 2015, inkludert Karambit og Bayonet.' },
  'gamma-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Gamma Case-lineup fra 2016, inkludert Karambit og M9 Bayonet.' },
  'glove-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Glove Case-lineup — den aller første hanske-casen i CS-historien.' },
  'spectrum-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Spectrum Case-lineup fra 2017, inkludert Butterfly Knife og Bowie Knife.' },
  'operation-hydra-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Operation Hydra Case-lineup, inkludert Sport Gloves.' },
  'prisma-2-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Prisma 2 Case-lineup — oppfølgeren til Prisma Case, inkludert Ursus Knife.' },
  'fracture-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Fracture Case-lineup fra 2020, inkludert Nomad og Paracord Knife.' },
  'operation-broken-fang-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Operation Broken Fang Case-lineup, inkludert Broken Fang Gloves.' },
  'snakebite-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Snakebite Case-lineup fra 2021.' },
  'operation-riptide-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Operation Riptide Case-lineup, inkludert Butterfly Knife.' },
  'dreams-nightmares-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Dreams & Nightmares Case-lineup fra 2021.' },
  'recoil-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Recoil Case-lineup fra 2022.' },
  'revolution-case': { casePrice: 800, keyPrice: 150, description: 'Ekte Revolution Case-lineup, inkludert Hydra Gloves.' },
  'kilowatt-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Kilowatt Case-lineup fra 2024, inkludert Kukri Knife.' },
  'fever-case': { casePrice: 500, keyPrice: 100, description: 'Ekte Fever Case-lineup — den nyeste casen i samlingen.' },
}

const DEFAULT_CASE_META = { casePrice: 500, keyPrice: 100, description: 'Ekte CS2-case-lineup, hentet direkte fra CS2 sitt droptabell-arkiv.' }

const skinsTs = `import type { Rarity, WeaponCategory } from '@prisma/client'

// Generert fra ekte CS2-data (ByMykel/CSGO-API, speiler Valves offisielle
// droptabeller). Bilder er hotlinket fra Steams egen CDN — se scripts/generate-cs2-seed-data.mjs.
// Intern bruk, ikke kommersielt: se avtale med bruker 2026-09-14.
export interface SkinSeed {
  slug: string
  name: string
  weaponCategory: WeaponCategory
  rarity: Rarity
  baseReferenceValue: number
  minFloat: number
  maxFloat: number
  specialEligible: boolean
  imageUrl?: string
}

export const skinSeeds: SkinSeed[] = [
${[...skinsBySlug.values()].map((s) => `  {
    slug: '${s.slug}',
    name: ${q(s.name)},
    weaponCategory: '${s.weaponCategory}',
    rarity: '${s.rarity}',
    baseReferenceValue: ${s.baseReferenceValue},
    minFloat: ${s.minFloat},
    maxFloat: ${s.maxFloat},
    specialEligible: ${s.rarity === 'SPECIAL'},
    imageUrl: ${q(s.imageUrl)},
  },`).join('\n')}
]
`

const casesTs = `export interface CaseSeed {
  slug: string
  name: string
  description: string
  imageUrl?: string
  casePrice: number
  keyPrice: number | null
  /** Skin slugs (see skins.ts) included in this case's drop table. */
  skinSlugs: string[]
}

// Generert fra ekte CS2-case-droptabeller (ByMykel/CSGO-API).
export const caseSeeds: CaseSeed[] = [
${caseSeeds.map((c) => {
  const meta = CASE_META[c.slug] ?? DEFAULT_CASE_META
  return `  {
    slug: '${c.slug}',
    name: ${q(c.name)},
    description: ${q(meta.description)},
    imageUrl: ${q(c.imageUrl)},
    casePrice: ${meta.casePrice},
    keyPrice: ${meta.keyPrice},
    skinSlugs: [
      ${c.skinSlugs.map((s) => `'${s}'`).join(',\n      ')},
    ],
  },`
}).join('\n')}
]
`

writeFileSync(join(root, 'prisma/seed-data/skins.ts'), skinsTs)
writeFileSync(join(root, 'prisma/seed-data/cases.ts'), casesTs)

console.log(`Wrote ${skinsBySlug.size} skins across ${caseSeeds.length} cases.`)
