<script setup lang="ts">
import type { InventoryItemDTO, MarketListingDTO } from '~~/types/dto'
import { fallbackValueForRarity } from '~~/types/fallback-prices'

definePageMeta({ middleware: 'auth' })

const sort = ref<'newest' | 'value_desc' | 'value_asc' | 'name'>('newest')
const { data: items, refresh } = await useFetch<InventoryItemDTO[]>('/api/inventory', {
  query: computed(() => ({ sort: sort.value })),
})

const listingItem = ref<InventoryItemDTO | null>(null)
const listingPrice = ref<number | null>(null)
const listingState = ref<'idle' | 'saving' | 'error'>('idle')
const listingError = ref('')

const inspectItem = ref<InventoryItemDTO | null>(null)

const { refresh: refreshWallet } = useWallet()
const quickSellState = ref<Record<string, 'idle' | 'confirming' | 'selling' | 'error'>>({})
const quickSellError = ref<Record<string, string>>({})

function quickSellPrice(item: InventoryItemDTO) {
  const referenceValue = item.skin.steamPriceCents != null ? Math.round(item.skin.steamPriceCents / 100) : fallbackValueForRarity(item.skin.rarity)
  return Math.floor(referenceValue * 0.8)
}

async function confirmQuickSell(item: InventoryItemDTO) {
  quickSellState.value[item.id] = 'selling'
  try {
    await $fetch(`/api/inventory/${item.id}/quick-sell`, {
      method: 'POST',
      body: { idempotencyKey: `quick-sell:${item.id}:${Date.now()}` },
    })
    await Promise.all([refresh(), refreshWallet()])
  } catch (err: unknown) {
    quickSellState.value[item.id] = 'error'
    quickSellError.value[item.id] = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Hurtigsalg feilet.'
  }
}

async function toggleFavorite(item: InventoryItemDTO) {
  await $fetch(`/api/inventory/${item.id}/favorite`, { method: 'PATCH', body: { favorited: !item.favorited } })
  await refresh()
}

async function toggleLock(item: InventoryItemDTO) {
  await $fetch(`/api/inventory/${item.id}/lock`, { method: 'PATCH', body: { locked: item.status !== 'LOCKED' } })
  await refresh()
}

function openListDialog(item: InventoryItemDTO) {
  listingItem.value = item
  // Suggest the real Steam value when we have one, otherwise a small
  // per-rarity fallback — baseReferenceValue (an internal, cosmetic number,
  // see schema.prisma) suggested wildly wrong prices like 250 kr for a skin
  // Steam prices at 3 kr.
  listingPrice.value = item.skin.steamPriceCents ? Math.round(item.skin.steamPriceCents / 100) : fallbackValueForRarity(item.skin.rarity)
  listingState.value = 'idle'
}

async function submitListing() {
  if (!listingItem.value || !listingPrice.value) return
  listingState.value = 'saving'
  try {
    await $fetch<MarketListingDTO>('/api/market', {
      method: 'POST',
      body: { inventoryItemId: listingItem.value.id, price: Math.round(listingPrice.value) },
    })
    listingItem.value = null
    await refresh()
  } catch (err: unknown) {
    listingState.value = 'error'
    listingError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kunne ikke legge ut objektet.'
  }
}
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-12">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-2xl">Inventory</h1>
      <select v-model="sort" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-1.5 text-sm">
        <option value="newest">Nyeste</option>
        <option value="value_desc">Høyest verdi</option>
        <option value="value_asc">Lavest verdi</option>
        <option value="name">Navn</option>
      </select>
    </header>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex flex-col gap-2 rounded-[var(--gc-radius-md)] border p-3"
        :class="`rarity-panel-${item.skin.rarity.toLowerCase()}`"
      >
        <button
          type="button"
          class="h-20 cursor-zoom-in rounded-[var(--gc-radius-sm)] bg-graphite-950/60"
          aria-label="Inspiser"
          @click="inspectItem = item"
        >
          <SkinSwatch
            :seed="item.patternSeed"
            :rarity="item.skin.rarity"
            :category="item.skin.weaponCategory"
            :image-url="item.skin.imageUrl"
            :name="item.skin.name"
          />
        </button>
        <p class="line-clamp-1 text-sm text-[var(--gc-text)]">{{ item.skin.name }}</p>
        <RarityBadge :rarity="item.skin.rarity" size="sm" />
        <p class="text-xs text-[var(--gc-text-muted)]">Float {{ item.floatValue.toFixed(4) }} · {{ item.wear }}</p>
        <p class="text-xs text-[var(--gc-text-muted)]">
          Steam-pris: {{ displaySteamPrice(item.skin.steamPriceCents, item.skin.steamPriceCurrency) }}
        </p>

        <div class="mt-1 flex items-center gap-2 text-xs">
          <button type="button" class="text-[var(--gc-text-muted)] hover:text-rarity-uncommon" @click="toggleFavorite(item)">
            {{ item.favorited ? '★ Favoritt' : '☆ Favoritt' }}
          </button>
          <button type="button" class="text-[var(--gc-text-muted)] hover:text-rarity-uncommon" @click="toggleLock(item)">
            {{ item.status === 'LOCKED' ? '🔒 Lås opp' : '🔓 Lås' }}
          </button>
        </div>

        <div v-if="item.status === 'AVAILABLE'" class="mt-1 flex flex-col gap-1.5">
          <div class="flex gap-1.5">
            <button
              type="button"
              class="flex-1 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-2 py-1.5 text-xs"
              @click="openListDialog(item)"
            >
              Legg ut
            </button>
            <button
              type="button"
              class="flex-1 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-2 py-1.5 text-xs hover:border-rarity-epic"
              @click="quickSellState[item.id] = 'confirming'"
            >
              Hurtigselg
            </button>
          </div>

          <div v-if="quickSellState[item.id] === 'confirming'" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950/60 p-2 text-xs">
            <p class="mb-1.5 text-[var(--gc-text-muted)]">Selg umiddelbart for {{ formatKr(quickSellPrice(item)) }} (20% under referanseverdi)?</p>
            <div class="flex gap-1.5">
              <button type="button" class="flex-1 rounded-[var(--gc-radius-sm)] bg-rarity-epic px-2 py-1 font-display text-graphite-950" @click="confirmQuickSell(item)">
                Selg
              </button>
              <button type="button" class="flex-1 rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] px-2 py-1" @click="quickSellState[item.id] = 'idle'">
                Avbryt
              </button>
            </div>
          </div>
          <p v-else-if="quickSellState[item.id] === 'selling'" class="text-xs text-[var(--gc-text-muted)]">Selger…</p>
          <p v-if="quickSellState[item.id] === 'error'" class="text-xs text-rarity-epic">{{ quickSellError[item.id] }}</p>
        </div>
        <p v-else-if="item.status === 'LISTED'" class="text-xs text-rarity-uncommon">På markedet</p>
      </div>

      <p v-if="items && items.length === 0" class="col-span-full text-sm text-[var(--gc-text-muted)]">
        Ingen objekter ennå — åpne en case for å komme i gang.
      </p>
    </div>

    <!-- List dialog -->
    <div v-if="listingItem" class="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-5">
        <p class="mb-1 font-display text-lg">Legg ut {{ listingItem.skin.name }}</p>
        <p class="mb-3 text-xs text-[var(--gc-text-muted)]">Markedsavgift trekkes automatisk ved salg.</p>
        <div class="mb-3 flex items-center gap-2">
          <input
            v-model.number="listingPrice"
            type="number"
            min="1"
            class="w-full rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-950 px-3 py-2"
          >
          <span class="text-sm text-[var(--gc-text-muted)]">kr</span>
        </div>
        <p v-if="listingState === 'error'" class="mb-2 text-sm text-rarity-epic">{{ listingError }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2 text-sm font-display text-graphite-950 disabled:opacity-50"
            :disabled="listingState === 'saving'"
            @click="submitListing"
          >
            {{ listingState === 'saving' ? 'Legger ut…' : 'Legg ut' }}
          </button>
          <button type="button" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 text-sm" @click="listingItem = null">
            Avbryt
          </button>
        </div>
      </div>
    </div>

    <InspectModal
      v-if="inspectItem"
      :seed="inspectItem.patternSeed"
      :rarity="inspectItem.skin.rarity"
      :category="inspectItem.skin.weaponCategory"
      :image-url="inspectItem.skin.imageUrl"
      :name="inspectItem.skin.name"
      :float-value="inspectItem.floatValue"
      :wear="inspectItem.wear"
      :steam-price-cents="inspectItem.skin.steamPriceCents"
      :steam-price-currency="inspectItem.skin.steamPriceCurrency"
      :steam-volume="inspectItem.skin.steamVolume"
      @close="inspectItem = null"
    />
  </main>
</template>
