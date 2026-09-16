<script setup lang="ts">
import type { MarketListingDTO } from '~~/types/dto'
import type { MarketEvent } from '~~/server/utils/market-events'

definePageMeta({ middleware: 'auth' })

const search = ref('')
const minPrice = ref<number | null>(null)
const maxPrice = ref<number | null>(null)
const sort = ref<'price_asc' | 'price_desc' | 'newest'>('newest')

const { data: listings, refresh } = await useFetch<MarketListingDTO[]>('/api/market', {
  query: computed(() => ({
    search: search.value || undefined,
    minPrice: minPrice.value || undefined,
    maxPrice: maxPrice.value || undefined,
  })),
})
const { data: myListings, refresh: refreshMine } = await useFetch<MarketListingDTO[]>('/api/market/mine')
const { refresh: refreshWallet } = useWallet()

const sortedListings = computed(() => {
  if (!listings.value) return []
  const items = [...listings.value]
  if (sort.value === 'price_asc') return items.sort((a, b) => a.price - b.price)
  if (sort.value === 'price_desc') return items.sort((a, b) => b.price - a.price)
  return items.sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime())
})

const inspectListing = ref<MarketListingDTO | null>(null)

const buyState = ref<Record<string, 'idle' | 'buying' | 'error'>>({})
const buyError = ref<Record<string, string>>({})

async function buy(listing: MarketListingDTO) {
  buyState.value[listing.id] = 'buying'
  try {
    await $fetch(`/api/market/${listing.id}/buy`, {
      method: 'POST',
      body: { idempotencyKey: `buy:${listing.id}:${Date.now()}` },
    })
    await refresh()
    refreshWallet()
  } catch (err: unknown) {
    buyState.value[listing.id] = 'error'
    buyError.value[listing.id] = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kjøp feilet.'
  }
}

async function cancel(listing: MarketListingDTO) {
  await $fetch(`/api/market/${listing.id}/cancel`, { method: 'POST' })
  await Promise.all([refresh(), refreshMine()])
}

// Live updates — any listing created/sold/cancelled by anyone refreshes the
// board, so two people never see stale "still available" state.
useMarketEvents((event: MarketEvent) => {
  if (event.type === 'listing_created' || event.type === 'listing_sold' || event.type === 'listing_cancelled') {
    refresh()
    refreshMine()
  }
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-12">
    <header class="mb-6">
      <h1 class="font-display text-2xl">Marked</h1>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <input
          v-model="search"
          type="search"
          placeholder="Søk etter skin…"
          class="w-full max-w-sm rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-2 text-sm"
        >
        <input
          v-model.number="minPrice"
          type="number"
          min="0"
          placeholder="Min pris"
          class="w-28 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-2 text-sm"
        >
        <input
          v-model.number="maxPrice"
          type="number"
          min="0"
          placeholder="Maks pris"
          class="w-28 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-2 text-sm"
        >
        <select v-model="sort" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-2 text-sm">
          <option value="newest">Nyeste</option>
          <option value="price_asc">Lavest pris</option>
          <option value="price_desc">Høyest pris</option>
        </select>
      </div>
    </header>

    <section v-if="myListings && myListings.length > 0" class="mb-8">
      <h2 class="mb-2 font-display text-lg">Mine annonser</h2>
      <ul class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
        <li v-for="l in myListings" :key="l.id" class="flex items-center gap-3 px-4 py-3 text-sm">
          <div class="h-10 w-10 flex-shrink-0 rounded-[var(--gc-radius-sm)] bg-graphite-950/60">
            <SkinSwatch
              :seed="l.item.patternSeed"
              :rarity="l.item.skin.rarity"
              :category="l.item.skin.weaponCategory"
              :image-url="l.item.skin.imageUrl"
              :name="l.item.skin.name"
            />
          </div>
          <span class="flex-1">{{ l.item.skin.name }} — {{ formatKr(l.price) }}</span>
          <button type="button" class="text-xs text-rarity-epic hover:underline" @click="cancel(l)">Kanseller</button>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="mb-2 font-display text-lg">Aktive annonser</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="l in sortedListings"
          :key="l.id"
          class="flex items-center gap-3 rounded-[var(--gc-radius-md)] border p-4"
          :class="`rarity-panel-${l.item.skin.rarity.toLowerCase()}`"
        >
          <button
            type="button"
            class="h-14 w-14 flex-shrink-0 cursor-zoom-in rounded-[var(--gc-radius-sm)] bg-graphite-950/60"
            aria-label="Inspiser"
            @click="inspectListing = l"
          >
            <SkinSwatch
              :seed="l.item.patternSeed"
              :rarity="l.item.skin.rarity"
              :category="l.item.skin.weaponCategory"
              :image-url="l.item.skin.imageUrl"
              :name="l.item.skin.name"
            />
          </button>
          <div class="min-w-0 flex-1">
            <p class="line-clamp-1 text-sm text-[var(--gc-text)]">{{ l.item.skin.name }}</p>
            <RarityBadge :rarity="l.item.skin.rarity" size="sm" />
            <p class="text-xs text-[var(--gc-text-muted)]">Float {{ l.item.floatValue.toFixed(4) }} · {{ l.item.wear }}</p>
            <p v-if="l.sellerUsername" class="text-xs text-[var(--gc-text-muted)]">Selger: {{ l.sellerUsername }}</p>
            <p class="text-xs text-[var(--gc-text-muted)]">
              {{ priceOrEstimate(l.item.skin.steamPriceCents, l.item.skin.steamPriceCurrency, l.item.skin.baseReferenceValue).estimated ? 'Estimert pris' : 'Steam-pris' }}:
              {{ priceOrEstimate(l.item.skin.steamPriceCents, l.item.skin.steamPriceCurrency, l.item.skin.baseReferenceValue).text }}
            </p>
            <p class="font-display text-rarity-uncommon">{{ formatKr(l.price) }}</p>
          </div>
          <div class="flex flex-shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-3 py-1.5 text-xs font-display text-graphite-950 disabled:opacity-50"
              :disabled="buyState[l.id] === 'buying'"
              @click="buy(l)"
            >
              {{ buyState[l.id] === 'buying' ? 'Kjøper…' : 'Kjøp' }}
            </button>
            <p v-if="buyState[l.id] === 'error'" class="text-xs text-rarity-epic">{{ buyError[l.id] }}</p>
          </div>
        </div>

        <p v-if="listings && listings.length === 0" class="col-span-full text-sm text-[var(--gc-text-muted)]">
          Ingen annonser matcher søket.
        </p>
      </div>
    </section>

    <InspectModal
      v-if="inspectListing"
      :seed="inspectListing.item.patternSeed"
      :rarity="inspectListing.item.skin.rarity"
      :category="inspectListing.item.skin.weaponCategory"
      :image-url="inspectListing.item.skin.imageUrl"
      :name="inspectListing.item.skin.name"
      :float-value="inspectListing.item.floatValue"
      :wear="inspectListing.item.wear"
      :steam-price-cents="inspectListing.item.skin.steamPriceCents"
      :steam-price-currency="inspectListing.item.skin.steamPriceCurrency"
      :steam-volume="inspectListing.item.skin.steamVolume"
      :base-reference-value="inspectListing.item.skin.baseReferenceValue"
      @close="inspectListing = null"
    />
  </main>
</template>
