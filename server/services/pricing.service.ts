import https from 'node:https'
import { prisma } from '~~/server/utils/prisma'
import { wearFromFloat } from '~~/server/utils/rng'
import type { Wear } from '@prisma/client'

const STEAM_APPID = 730
const CURRENCY_NOK = 9
const REQUEST_DELAY_MS = 1500
const MAX_RETRIES = 2
const FETCH_TIMEOUT_MS = 15_000

/**
 * Deliberately uses node:https instead of the global fetch() (undici).
 * Steam/Akamai's bot-protection layer blocks undici's requests outright
 * (near-instant 429s, regardless of User-Agent or request spacing) while
 * identical requests over node:https succeed immediately — almost
 * certainly a TLS/HTTP2-level client fingerprint check, not a rate limit.
 * Confirmed by direct A/B testing before landing this.
 */
function httpsGetJson(url: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk
        })
        res.on('end', () => {
          let data: unknown = null
          try {
            data = JSON.parse(body)
          } catch {
            // leave data null — callers treat that as "no usable response"
          }
          resolve({ status: res.statusCode ?? 0, data })
        })
      },
    )
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error('request timed out')))
    req.on('error', reject)
  })
}

// Valve sells every case key at the same fixed store price — it's not
// something that fluctuates, and the only API that exposes it directly
// (ISteamEconomy/GetAssetPrices) requires a personal Steam Web API key. The
// free, anonymous Market lookup below is used only to confirm whether a
// given case actually has a separate key at all (many current cases don't).
const FIXED_KEY_PRICE_KR = 25

const WEAR_TO_EXTERIOR: Record<Wear, string> = {
  PRISTINE: 'Factory New',
  LIGHTLY_USED: 'Minimal Wear',
  FIELD_TESTED: 'Field-Tested',
  WORN: 'Well-Worn',
  BATTLE_SCARRED: 'Battle-Scarred',
}

/**
 * Steam prices weapon/knife finishes per exterior, not per skin — this picks
 * one representative exterior (the midpoint of the skin's real float range)
 * so every skin has exactly one reference price. Vanilla knives/gloves
 * (name has no "| Finish") are never wear-conditioned on the market, so
 * those are looked up by their bare name.
 */
export function marketHashNameFor(skin: { name: string; minFloat: number; maxFloat: number }): string {
  if (!skin.name.includes('|')) return skin.name
  const midFloat = (skin.minFloat + skin.maxFloat) / 2
  const exterior = WEAR_TO_EXTERIOR[wearFromFloat(midFloat)]
  return `${skin.name} (${exterior})`
}

/** Steam formats prices like "506,43 kr" or "1.234,56 kr" — Norwegian thousands/decimal separators. */
export function parsePriceToCents(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null
  const match = priceStr.match(/[\d.,]+/)
  if (!match) return null
  const normalized = match[0].replace(/\./g, '').replace(',', '.')
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

interface SteamPriceOverview {
  success: boolean
  lowest_price?: string
  median_price?: string
  volume?: string
}

async function fetchPrice(marketHashName: string, attempt = 0): Promise<{ cents: number; volume: number | null } | null> {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=${STEAM_APPID}&currency=${CURRENCY_NOK}&market_hash_name=${encodeURIComponent(marketHashName)}`

  let res: { status: number; data: unknown }
  try {
    res = await httpsGetJson(url)
  } catch {
    return null // network error or timed out — treat like any other failed lookup
  }

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) return null
    await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)))
    return fetchPrice(marketHashName, attempt + 1)
  }
  if (res.status < 200 || res.status >= 300) return null

  const data = res.data as SteamPriceOverview | null
  if (!data?.success) return null

  const cents = parsePriceToCents(data.median_price ?? data.lowest_price)
  if (cents === null) return null

  const volumeNum = data.volume ? Number.parseInt(data.volume.replace(/[^\d]/g, ''), 10) : NaN
  return { cents, volume: Number.isFinite(volumeNum) ? volumeNum : null }
}

type CaseOrKeyPriceResult = { kind: 'price'; kr: number } | { kind: 'no-listings' } | { kind: 'error' }

/**
 * Unlike skins (display-only), a case is itself a real, individually-listed
 * Steam Market item, and its price here directly sets what a player pays to
 * open it. A failed request returns 'error' so the caller leaves the
 * existing price alone rather than guessing or zeroing it out.
 */
async function fetchCaseOrKeyPrice(marketHashName: string, attempt = 0): Promise<CaseOrKeyPriceResult> {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=${STEAM_APPID}&currency=${CURRENCY_NOK}&market_hash_name=${encodeURIComponent(marketHashName)}`

  let res: { status: number; data: unknown }
  try {
    res = await httpsGetJson(url)
  } catch {
    return { kind: 'error' } // network error or timed out — never touch existing data for this
  }

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) return { kind: 'error' }
    await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)))
    return fetchCaseOrKeyPrice(marketHashName, attempt + 1)
  }
  if (res.status < 200 || res.status >= 300) return { kind: 'error' }

  const data = res.data as SteamPriceOverview | null
  if (!data?.success) return { kind: 'error' }

  const cents = parsePriceToCents(data.median_price ?? data.lowest_price)
  if (cents === null) return { kind: 'no-listings' }

  return { kind: 'price', kr: Math.max(1, Math.round(cents / 100)) }
}

export const pricingService = {
  marketHashNameFor,
  parsePriceToCents,

  /**
   * Refreshes every skin's Steam reference price, one request at a time.
   * Display-only data — never touches credits, odds or anything economic.
   * Takes minutes for a full catalog; intended to run from a scheduled
   * task or an explicit admin trigger, never inline in a user request.
   */
  async refreshAllPrices() {
    const skins = await prisma.skinDefinition.findMany({
      select: { id: true, name: true, minFloat: true, maxFloat: true },
    })

    let updated = 0
    let failed = 0

    for (const [i, skin] of skins.entries()) {
      try {
        const price = await fetchPrice(marketHashNameFor(skin))

        if (price) {
          await prisma.skinDefinition.update({
            where: { id: skin.id },
            data: {
              steamPriceCents: price.cents,
              steamVolume: price.volume,
              steamPriceUpdatedAt: new Date(),
            },
          })
          updated++
        } else {
          failed++
        }
      } catch (err) {
        // A single bad DB write (e.g. a dropped pooled connection) must
        // never take down the rest of a multi-hundred-item batch.
        console.error(`[pricing] failed to update ${skin.name}:`, err)
        failed++
      }

      if (i < skins.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    }

    return { updated, failed, total: skins.length }
  },

  /**
   * Sets each case's real price (in whole kr) directly from Steam. This is
   * the one place a background refresh actually changes what a player pays,
   * so a failed fetch leaves the existing price alone rather than guessing.
   *
   * The key price is not looked up: every weapon case in CS2 requires one,
   * and they all cost the same fixed store price. Deciding it from Market
   * listings (as this used to) got it wrong for every case released after
   * Valve made new keys non-tradeable in late 2019 — those keys are still
   * required and still cost the same, they just can't appear on the Market,
   * which the lookup misread as "this case needs no key".
   */
  async refreshCasePrices() {
    const cases = await prisma.caseDefinition.findMany({ select: { id: true, name: true } })

    let updated = 0
    let failed = 0

    for (const [i, c] of cases.entries()) {
      console.log(`[pricing] case ${i + 1}/${cases.length}: ${c.name}`)
      try {
        const caseResult = await fetchCaseOrKeyPrice(c.name)
        console.log(`[pricing]   case price lookup -> ${caseResult.kind}`)

        if (caseResult.kind === 'price') {
          await prisma.caseDefinition.update({
            where: { id: c.id },
            data: { casePrice: caseResult.kr, keyPrice: FIXED_KEY_PRICE_KR },
          })
          updated++
        } else {
          failed++
        }
      } catch (err) {
        console.error(`[pricing] failed to update case ${c.name}:`, err)
        failed++
      }

      if (i < cases.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    }

    return { updated, failed, total: cases.length }
  },
}
