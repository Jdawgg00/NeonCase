<script setup lang="ts">
import { nanoid } from 'nanoid'
import type { CaseDetailDTO, CaseDropOddsDTO, CaseOpeningResultDTO } from '~~/types/dto'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const slug = route.params.slug as string

const { data: caseDetail } = await useFetch<CaseDetailDTO>(`/api/cases/${slug}`)
const { refresh: refreshWallet } = useWallet()

const RARITY_ORDER = ['SPECIAL', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']
const showOdds = ref(false)
const oddsByRarity = computed<{ rarity: string; percent: number }[]>(() => {
  if (!caseDetail.value) return []
  const totals = new Map<string, number>()
  for (const drop of caseDetail.value.drops) {
    totals.set(drop.rarity, (totals.get(drop.rarity) ?? 0) + drop.probabilityPercent)
  }
  return RARITY_ORDER.filter((r) => totals.has(r)).map((rarity) => ({
    rarity,
    percent: Math.round((totals.get(rarity) ?? 0) * 100) / 100,
  }))
})

// Grouped highest-rarity-first, matching how CS2's own case pages lay out
// their contents — a knife/glove row up top, common skins at the bottom.
// SPECIAL is excluded here — real CS2 never tells you the exact
// finish/float odds for the rare item ahead of time, just that one exists.
const dropsByRarity = computed(() => {
  if (!caseDetail.value) return []
  const groups = new Map<string, CaseDropOddsDTO[]>()
  for (const drop of caseDetail.value.drops) {
    if (drop.rarity === 'SPECIAL') continue
    if (!groups.has(drop.rarity)) groups.set(drop.rarity, [])
    groups.get(drop.rarity)!.push(drop)
  }
  return RARITY_ORDER.filter((r) => r !== 'SPECIAL' && groups.has(r)).map((rarity) => ({
    rarity,
    drops: groups.get(rarity)!.sort((a, b) => a.name.localeCompare(b.name)),
  }))
})

// One card per distinct knife/glove type (e.g. "Navaja Knife"), not per
// finish — the specific paint job, float and price are a surprise until you
// actually open it, exactly like the in-game case-contents screen.
const specialItemTypes = computed(() => {
  if (!caseDetail.value) return []
  const byBaseName = new Map<string, CaseDropOddsDTO>()
  for (const drop of caseDetail.value.drops) {
    if (drop.rarity !== 'SPECIAL') continue
    const baseName = drop.name.split('|')[0]!.trim()
    const existing = byBaseName.get(baseName)
    // Prefer the vanilla (no finish) listing as the representative image when one exists.
    if (!existing || (!drop.name.includes('|') && existing.name.includes('|'))) {
      byBaseName.set(baseName, drop)
    }
  }
  return [...byBaseName.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const specialPercent = computed(() => {
  const entries = oddsByRarity.value
  for (const entry of entries) {
    if (entry.rarity === 'SPECIAL') return entry.percent
  }
  return undefined
})

type OpenState = 'idle' | 'confirming' | 'revealing' | 'done' | 'error'
const state = ref<OpenState>('idle')
const errorMessage = ref('')
const result = ref<CaseOpeningResultDTO | null>(null)

async function confirmOpen() {
  if (!caseDetail.value) return
  // Mount the reel immediately — it starts spinning on its own before the
  // real result even exists (see CaseOpeningReel) — so there's no dead
  // "opening…" screen between the click and the roll.
  result.value = null
  state.value = 'revealing'
  errorMessage.value = ''

  try {
    result.value = await $fetch<CaseOpeningResultDTO>(`/api/cases/${caseDetail.value.slug}/open`, {
      method: 'POST',
      body: { idempotencyKey: `open:${caseDetail.value.slug}:${nanoid()}` },
    })
    refreshWallet()
  } catch (err: unknown) {
    state.value = 'error'
    errorMessage.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kunne ikke åpne casen. Prøv igjen.'
  }
}

function onReelFinished() {
  state.value = 'done'
  // The reel already built the suspense — go straight into the inspectable
  // view of what was won instead of making the player hunt for a button.
  inspecting.value = true
}

function openAnother() {
  result.value = null
  state.value = 'idle'
  inspecting.value = false
}

const inspecting = ref(false)
</script>

<template>
  <main v-if="caseDetail" class="mx-auto max-w-5xl px-6 py-12">
    <NuxtLink to="/cases" class="text-sm text-[var(--gc-text-muted)] hover:underline">← Alle cases</NuxtLink>

    <!-- Hero: the case itself, front and center -->
    <div class="mx-auto mb-8 mt-6 flex max-w-2xl flex-col items-center gap-4 text-center">
      <div class="flex h-52 w-52 items-center justify-center rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-gradient-to-br from-graphite-800 to-graphite-950 p-10 text-rarity-special">
        <img v-if="caseDetail.imageUrl" :src="caseDetail.imageUrl" :alt="caseDetail.name" class="h-full w-full object-contain">
        <svg v-else viewBox="0 0 64 64" fill="none" class="h-full w-full">
          <rect x="6" y="22" width="52" height="34" rx="2" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2" />
          <path d="M6 22 32 8l26 14" fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          <path d="M32 8v48" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5" />
          <path d="M6 22l26 14 26-14" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.6" />
        </svg>
      </div>

      <div>
        <h1 class="font-display text-2xl">{{ caseDetail.name }}</h1>
        <p class="mt-1 text-sm text-[var(--gc-text-muted)]">{{ caseDetail.description }}</p>
      </div>

      <div class="relative flex items-center gap-2">
        <p class="font-display text-xl text-rarity-uncommon">
          {{ formatKr(caseDetail.casePrice) }}<span v-if="caseDetail.keyPrice"> + {{ formatKr(caseDetail.keyPrice) }} nøkkel</span>
        </p>
        <button
          type="button"
          aria-label="Vis sjanser per sjeldenhet"
          class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[var(--gc-steel-700)] text-xs font-display text-[var(--gc-text-muted)] transition hover:border-rarity-uncommon hover:text-rarity-uncommon"
          @click="showOdds = !showOdds"
        >
          !
        </button>

        <div
          v-if="showOdds"
          class="absolute left-1/2 top-8 z-20 w-56 -translate-x-1/2 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3 text-left shadow-xl"
        >
          <p class="mb-2 text-xs text-[var(--gc-text-muted)]">Sjanse for å treffe hver sjeldenhet</p>
          <ul class="space-y-1.5">
            <li v-for="o in oddsByRarity" :key="o.rarity" class="flex items-center justify-between text-sm">
              <RarityBadge :rarity="o.rarity" size="sm" />
              <span class="text-[var(--gc-text)]">{{ o.percent }}%</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-2xl">
      <!-- Reveal area -->
      <section v-if="state === 'revealing' || state === 'done'" class="mb-8">
        <CaseOpeningReel
          :possible-drops="caseDetail.drops"
          :result="result?.item ?? null"
          @finished="onReelFinished"
        />

        <div v-if="state === 'done' && result" class="mt-4 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-sm text-[var(--gc-text-muted)]">Du fikk</p>
          <p class="font-display text-xl" :class="`rarity-${result.item.skin.rarity.toLowerCase()}`">{{ result.item.skin.name }}</p>
          <p class="text-xs text-[var(--gc-text-muted)]">
            Float {{ result.item.floatValue.toFixed(4) }} · {{ result.item.wear }}
          </p>
          <div class="mt-3 flex gap-2">
            <button type="button" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 text-sm" @click="inspecting = true">
              Inspiser
            </button>
            <NuxtLink to="/inventory" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 text-sm">
              Se i inventory
            </NuxtLink>
            <button type="button" class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2 text-sm font-display text-graphite-950" @click="openAnother">
              Åpne en til
            </button>
          </div>
        </div>
      </section>

      <!-- Confirm / error state -->
      <section v-else class="mb-8 text-center">
        <button
          v-if="state !== 'confirming'"
          type="button"
          class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-5 py-2.5 font-display text-graphite-950"
          @click="state = 'confirming'"
        >
          Kjøp og åpne
        </button>

        <div v-else class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4 text-left">
          <p class="mb-3 text-sm">
            Bekreft: trekk {{ formatKr(caseDetail.casePrice + (caseDetail.keyPrice ?? 0)) }} og åpne {{ caseDetail.name }}?
          </p>
          <div class="flex gap-2">
            <button type="button" class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2 text-sm font-display text-graphite-950" @click="confirmOpen">
              Ja, åpne
            </button>
            <button type="button" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 text-sm" @click="state = 'idle'">
              Avbryt
            </button>
          </div>
        </div>

        <p v-if="state === 'error'" class="mt-3 text-sm text-rarity-epic">{{ errorMessage }}</p>
      </section>
    </div>

    <!-- Published odds — grouped by rarity, highest first, like the real case pages -->
    <section>
      <h2 class="mb-4 text-center font-display text-lg">Innhold</h2>

      <div v-if="specialItemTypes.length > 0" class="mb-6">
        <div class="mb-2 flex items-center gap-2">
          <RarityBadge rarity="SPECIAL" size="sm" />
          <div class="h-px flex-1" style="background-color: var(--gc-special); opacity: 0.25" />
          <span class="text-xs text-[var(--gc-text-muted)]">
            {{ specialPercent }}% sjanse
          </span>
        </div>

        <!-- Generic gold indicator only — no specific knife/glove revealed
             here, exactly like the real in-game case-contents screen. Which
             one, its finish and its float are all a surprise on open. -->
        <div class="flex flex-col items-center gap-2 rounded-[var(--gc-radius-md)] border p-6 text-center rarity-panel-special">
          <div class="h-14 w-14 flex-shrink-0 text-rarity-special">
            <WeaponIcon category="BLADES" />
          </div>
          <p class="font-display text-sm text-rarity-special">★ Sjelden spesialgjenstand</p>
          <p class="text-xs text-[var(--gc-text-muted)]">Hvilken, finish og float avsløres først når du åpner casen.</p>
        </div>
      </div>

      <div v-for="group in dropsByRarity" :key="group.rarity" class="mb-6">
        <div class="mb-2 flex items-center gap-2">
          <RarityBadge :rarity="group.rarity" size="sm" />
          <div class="h-px flex-1" :style="{ backgroundColor: `var(--gc-${group.rarity.toLowerCase()})`, opacity: 0.25 }" />
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div
            v-for="drop in group.drops"
            :key="drop.id"
            class="flex flex-col items-center gap-2 rounded-[var(--gc-radius-md)] border p-3 text-center"
            :class="`rarity-panel-${drop.rarity.toLowerCase()}`"
          >
            <div class="h-16 w-16 flex-shrink-0 rounded-[var(--gc-radius-sm)] bg-graphite-950/60">
              <SkinSwatch :seed="drop.id" :rarity="drop.rarity" :category="drop.weaponCategory" :image-url="drop.imageUrl" :name="drop.name" />
            </div>
            <p class="line-clamp-2 text-xs text-[var(--gc-text)]">{{ drop.name }}</p>
            <p class="text-xs text-[var(--gc-text-muted)]">{{ drop.probabilityPercent }}%</p>
            <p v-if="formatSteamPrice(drop.steamPriceCents, drop.steamPriceCurrency)" class="text-xs text-[var(--gc-text-muted)]">
              {{ formatSteamPrice(drop.steamPriceCents, drop.steamPriceCurrency) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <InspectModal
      v-if="inspecting && result"
      :seed="result.item.patternSeed"
      :rarity="result.item.skin.rarity"
      :category="result.item.skin.weaponCategory"
      :image-url="result.item.skin.imageUrl"
      :name="result.item.skin.name"
      :float-value="result.item.floatValue"
      :wear="result.item.wear"
      :steam-price-cents="result.item.skin.steamPriceCents"
      :steam-price-currency="result.item.skin.steamPriceCurrency"
      :steam-volume="result.item.skin.steamVolume"
      @close="inspecting = false"
    />
  </main>
</template>
