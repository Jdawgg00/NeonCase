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
  caseName: string
  createdAt: string
}
interface LeaderboardsResponse {
  inventoryValue: { userId: string; username: string; value: number }[]
  caseOpenings: { userId: string; username: string; count: number }[]
  todaysBestDrop: DropHighlight | null
  todaysWorstDrop: DropHighlight | null
  goldDrops: GoldDrop[]
}

const { data } = await useFetch<LeaderboardsResponse>('/api/leaderboards')
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12">
    <h1 class="mb-6 font-display text-2xl">Leaderboards</h1>

    <div v-if="data?.todaysBestDrop || data?.todaysWorstDrop" class="mb-8 grid gap-4 sm:grid-cols-2">
      <div v-if="data?.todaysBestDrop" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
        <p class="mb-1 text-xs uppercase tracking-wide text-[var(--gc-text-muted)]">Dagens beste drop</p>
        <p>
          <span class="text-[var(--gc-text)]">{{ data.todaysBestDrop.username }}</span>
          <span class="text-[var(--gc-text-muted)]"> fikk </span>
          <span :class="`rarity-${data.todaysBestDrop.rarity.toLowerCase()}`">{{ data.todaysBestDrop.skinName }}</span>
        </p>
        <p class="font-display text-rarity-uncommon">{{ formatKr(data.todaysBestDrop.value) }}</p>
      </div>
      <div v-if="data?.todaysWorstDrop" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
        <p class="mb-1 text-xs uppercase tracking-wide text-[var(--gc-text-muted)]">Dagens verste drop</p>
        <p>
          <span class="text-[var(--gc-text)]">{{ data.todaysWorstDrop.username }}</span>
          <span class="text-[var(--gc-text-muted)]"> fikk </span>
          <span :class="`rarity-${data.todaysWorstDrop.rarity.toLowerCase()}`">{{ data.todaysWorstDrop.skinName }}</span>
        </p>
        <p class="font-display text-rarity-epic">{{ formatKr(data.todaysWorstDrop.value) }}</p>
      </div>
    </div>

    <section v-if="data?.goldDrops?.length" class="mb-8">
      <h2 class="mb-2 font-display text-lg">🏆 Gullfunn — hall of fame</h2>
      <ol class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
        <li v-for="drop in data.goldDrops" :key="drop.id" class="rarity-panel-special flex items-center justify-between px-4 py-2 text-sm">
          <span>
            <span class="text-[var(--gc-text)]">{{ drop.username }}</span>
            <span class="text-[var(--gc-text-muted)]"> fikk </span>
            <span class="rarity-special font-display">{{ drop.skinName }}</span>
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
    </div>
  </main>
</template>
