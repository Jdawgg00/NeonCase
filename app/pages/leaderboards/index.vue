<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface DropHighlight {
  username: string
  skinName: string
  rarity: string
  caseName: string
  value: number
  createdAt: string
}
interface GoldDrop {
  id: string
  username: string
  skinName: string
  phase: string | null
  caseName: string
  createdAt: string
}
interface LeaderboardsResponse {
  inventoryValue: { userId: string; username: string; value: number }[]
  caseOpenings: { userId: string; username: string; count: number }[]
  todaysBestByRarity: DropHighlight[]
  goldDrops: GoldDrop[]
  adminGifted: { username: string; amount: number }[]
}

const { data } = await useFetch<LeaderboardsResponse>('/api/leaderboards')
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12">
    <h1 class="mb-6 font-display text-2xl">Leaderboards</h1>

    <section v-if="data?.todaysBestByRarity?.length" class="mb-8">
      <h2 class="mb-2 font-display text-lg">Dagens beste drop per kategori</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-for="drop in data.todaysBestByRarity" :key="drop.rarity" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="mb-1 text-xs uppercase tracking-wide text-[var(--gc-text-muted)]">{{ drop.rarity }}</p>
          <p>
            <span class="text-[var(--gc-text)]">{{ drop.username }}</span>
            <span class="text-[var(--gc-text-muted)]"> fikk </span>
            <span :class="`rarity-${drop.rarity.toLowerCase()}`">{{ drop.skinName }}</span>
          </p>
          <p class="font-display" :class="`rarity-${drop.rarity.toLowerCase()}`">{{ formatKr(drop.value) }}</p>
        </div>
      </div>
    </section>

    <section v-if="data?.goldDrops?.length" class="mb-8">
      <h2 class="mb-2 font-display text-lg">🏆 Gullfunn — hall of fame</h2>
      <ol class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
        <li v-for="drop in data.goldDrops" :key="drop.id" class="rarity-panel-special flex items-center justify-between px-4 py-2 text-sm">
          <span>
            <span class="text-[var(--gc-text)]">{{ drop.username }}</span>
            <span class="text-[var(--gc-text-muted)]"> fikk </span>
            <span class="rarity-special font-display">{{ drop.skinName }}</span>
            <span v-if="drop.phase" class="text-rarity-special"> ({{ drop.phase }})</span>
            <span class="text-[var(--gc-text-muted)]"> fra {{ drop.caseName }}</span>
          </span>
          <span class="flex-shrink-0 text-xs text-[var(--gc-text-muted)]">{{ new Date(drop.createdAt).toLocaleDateString('nb-NO') }}</span>
        </li>
      </ol>
    </section>

    <div class="grid gap-8 sm:grid-cols-2">
      <section>
        <h2 class="mb-2 font-display text-lg">Høyest inventory-verdi</h2>
        <ol class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
          <li v-for="(row, i) in data?.inventoryValue" :key="row.userId" class="flex justify-between px-4 py-2 text-sm">
            <span>{{ i + 1 }}. {{ row.username }}</span>
            <span class="text-rarity-uncommon">{{ formatKr(row.value) }}</span>
          </li>
        </ol>
      </section>

      <section>
        <h2 class="mb-2 font-display text-lg">Flest åpninger</h2>
        <ol class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
          <li v-for="(row, i) in data?.caseOpenings" :key="row.userId" class="flex justify-between px-4 py-2 text-sm">
            <span>{{ i + 1 }}. {{ row.username }}</span>
            <span class="text-rarity-uncommon">{{ row.count }}</span>
          </li>
        </ol>
      </section>

      <section v-if="data?.adminGifted?.length">
        <h2 class="mb-2 font-display text-lg">💸 Mest bortskjemt av admin</h2>
        <ol class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
          <li v-for="(row, i) in data.adminGifted" :key="row.username" class="flex justify-between px-4 py-2 text-sm">
            <span>{{ i + 1 }}. {{ row.username }}</span>
            <span class="text-rarity-uncommon">{{ formatKr(row.amount) }}</span>
          </li>
        </ol>
      </section>
    </div>
  </main>
</template>
