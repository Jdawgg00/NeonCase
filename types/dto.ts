import type { CaseDefinition, CaseDrop, CaseOpening, InventoryItem, MarketListing, SkinDefinition, WalletTransaction } from '@prisma/client'

export interface WalletDTO {
  balance: number
}

export interface WalletTransactionDTO {
  id: string
  type: string
  amount: number
  balanceAfter: number
  createdAt: string
  referenceType: string | null
}

export function toWalletTransactionDTO(tx: WalletTransaction): WalletTransactionDTO {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    createdAt: tx.createdAt.toISOString(),
    referenceType: tx.referenceType,
  }
}

// --- Cases / skins ---

export interface CaseSummaryDTO {
  id: string
  slug: string
  name: string
  description: string
  imageUrl: string | null
  casePrice: number
  keyPrice: number | null
  isLimitedTime: boolean
}

export function toCaseSummaryDTO(c: CaseDefinition): CaseSummaryDTO {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    casePrice: c.casePrice,
    keyPrice: c.keyPrice,
    isLimitedTime: Boolean(c.startsAt || c.endsAt),
  }
}

export interface SkinDTO {
  id: string
  slug: string
  name: string
  weaponCategory: string
  rarity: string
  imageUrl: string | null
  baseReferenceValue: number
  /** Real Steam Community Market reference price, in minor units (øre) — display only, null until the first refresh has run. */
  steamPriceCents: number | null
  steamPriceCurrency: string | null
  steamVolume: number | null
  steamPriceUpdatedAt: string | null
}

export function toSkinDTO(s: SkinDefinition): SkinDTO {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    weaponCategory: s.weaponCategory,
    rarity: s.rarity,
    imageUrl: s.imageUrl,
    baseReferenceValue: s.baseReferenceValue,
    steamPriceCents: s.steamPriceCents,
    steamPriceCurrency: s.steamPriceCurrency,
    steamVolume: s.steamVolume,
    steamPriceUpdatedAt: s.steamPriceUpdatedAt ? s.steamPriceUpdatedAt.toISOString() : null,
  }
}

export interface CaseDropOddsDTO extends SkinDTO {
  /** Published, exact probability — always shown to the player, never just in an admin tool. */
  probabilityPercent: number
}

export interface CaseDetailDTO extends CaseSummaryDTO {
  versionNumber: number
  drops: CaseDropOddsDTO[]
}

export function toCaseDetailDTO(
  c: CaseDefinition,
  version: { version: number; totalWeight: number; drops: (CaseDrop & { skinDefinition: SkinDefinition })[] },
): CaseDetailDTO {
  return {
    ...toCaseSummaryDTO(c),
    versionNumber: version.version,
    drops: version.drops
      .map((d) => ({
        ...toSkinDTO(d.skinDefinition),
        probabilityPercent: Math.round((d.weight / version.totalWeight) * 10_000) / 100,
      }))
      .sort((a, b) => a.probabilityPercent - b.probabilityPercent),
  }
}

// --- Inventory ---

export interface InventoryItemDTO {
  id: string
  skin: SkinDTO
  floatValue: number
  wear: string
  patternSeed: number
  specialVariant: string | null
  favorited: boolean
  status: string
  sourceType: string
  acquiredAt: string
}

export function toInventoryItemDTO(item: InventoryItem & { skinDefinition: SkinDefinition }): InventoryItemDTO {
  return {
    id: item.id,
    skin: toSkinDTO(item.skinDefinition),
    floatValue: item.floatValue,
    wear: item.wear,
    patternSeed: item.patternSeed,
    specialVariant: item.specialVariant,
    favorited: item.favorited,
    status: item.status,
    sourceType: item.sourceType,
    acquiredAt: item.acquiredAt.toISOString(),
  }
}

// --- Case opening result ---

export interface CaseOpeningResultDTO {
  openingId: string
  item: InventoryItemDTO
  totalCost: number
  replay: boolean
}

export function toCaseOpeningResultDTO(
  opening: CaseOpening & { inventoryItem: InventoryItem & { skinDefinition: SkinDefinition } },
  replay: boolean,
): CaseOpeningResultDTO {
  return {
    openingId: opening.id,
    item: toInventoryItemDTO(opening.inventoryItem),
    totalCost: opening.totalCost,
    replay,
  }
}

// --- Market ---

export interface MarketListingDTO {
  id: string
  price: number
  feeRate: number
  sellerId: string
  item: InventoryItemDTO
  listedAt: string
}

export function toMarketListingDTO(
  listing: MarketListing & { inventoryItem: InventoryItem & { skinDefinition: SkinDefinition } },
): MarketListingDTO {
  return {
    id: listing.id,
    price: listing.price,
    feeRate: listing.feeRate,
    sellerId: listing.sellerId,
    item: toInventoryItemDTO(listing.inventoryItem),
    listedAt: listing.listedAt.toISOString(),
  }
}

export interface PriceHistoryPointDTO {
  price: number
  soldAt: string
}

