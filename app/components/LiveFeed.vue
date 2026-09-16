<script setup lang="ts">
import type { FeedEntryDTO } from '~~/types/dto'

// Polling, not a websocket push — the app's only pub/sub path
// (server/routes/ws/market.ts) needs Redis, which isn't wired up on this
// deployment. A few seconds of staleness is fine for a "look what people
// are pulling" feed.
const POLL_INTERVAL_MS = 4000

const { data: entries, refresh } = await useFetch<FeedEntryDTO[]>('/api/feed/recent')

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(refresh, POLL_INTERVAL_MS)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}t`
}

// SPECIAL is the rarest tier ("gold") — celebrate a fresh one with a banner
// above the ordinary list, not just the same small row as everything else.
const RECENT_SPECIAL_WINDOW_MS = 2 * 60 * 1000
const latestSpecialDrop = computed(() => {
  const drop = entries.value?.find((e) => e.rarity === 'SPECIAL')
  if (!drop) return null
  return Date.now() - new Date(drop.createdAt).getTime() <= RECENT_SPECIAL_WINDOW_MS ? drop : null
})
</script>

<template>
  <section class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
    <div
      v-if="latestSpecialDrop"
      class="rarity-panel-special mb-3 animate-pulse rounded-[var(--gc-radius-md)] border p-3 text-sm"
    >
      🏆 <span class="text-[var(--gc-text)]">{{ latestSpecialDrop.username }}</span> fikk nettopp
      <span class="rarity-special font-display">{{ latestSpecialDrop.skinName }}</span>
      fra {{ latestSpecialDrop.caseName }} — gullfunn!
    </div>

    <h2 class="mb-3 font-display text-sm text-[var(--gc-text-muted)]">Nylige unboxinger</h2>
    <ul class="max-h-80 space-y-2 overflow-y-auto">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex items-center justify-between gap-2 rounded-[var(--gc-radius-sm)] text-sm"
        :class="entry.rarity === 'SPECIAL' ? 'rarity-panel-special border px-2 py-1' : ''"
      >
        <span class="truncate">
          <span v-if="entry.rarity === 'SPECIAL'">🏆 </span>
          <span class="text-[var(--gc-text)]">{{ entry.username }}</span>
          <span class="text-[var(--gc-text-muted)]"> unboxet </span>
          <span :class="`rarity-${entry.rarity.toLowerCase()}`">{{ entry.skinName }}</span>
          <span class="text-[var(--gc-text-muted)]"> fra {{ entry.caseName }}</span>
        </span>
        <span class="flex-shrink-0 text-xs text-[var(--gc-text-muted)]">{{ timeAgo(entry.createdAt) }}</span>
      </li>
      <li v-if="entries && entries.length === 0" class="text-sm text-[var(--gc-text-muted)]">
        Ingen unboxinger ennå.
      </li>
    </ul>
  </section>
</template>
