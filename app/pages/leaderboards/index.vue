<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface LeaderboardsResponse {
  inventoryValue: { userId: string; username: string; value: number }[]
  caseOpenings: { userId: string; username: string; count: number }[]
}

const { data } = await useFetch<LeaderboardsResponse>('/api/leaderboards')
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-12">
    <h1 class="mb-6 font-display text-2xl">Leaderboards</h1>

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
