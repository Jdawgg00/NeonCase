<script setup lang="ts">
import type { CaseSummaryDTO } from '~~/types/dto'

definePageMeta({ middleware: 'auth' })

const { data: cases } = await useFetch<CaseSummaryDTO[]>('/api/cases')
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-12">
    <header class="mb-8">
      <h1 class="font-display text-2xl">Cases</h1>
      <p class="text-sm text-[var(--gc-text-muted)]">
        Alle odds er publisert på hver case sin side. Ingen skjulte sannsynligheter.
      </p>
    </header>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="c in cases"
        :key="c.id"
        :to="`/cases/${c.slug}`"
        class="group rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4 transition hover:border-rarity-special hover:shadow-[0_0_18px_-6px_var(--gc-special)]"
      >
        <div class="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-[var(--gc-radius-sm)] bg-gradient-to-br from-graphite-800 to-graphite-950 p-8 text-rarity-special transition group-hover:scale-105">
          <img v-if="c.imageUrl" :src="c.imageUrl" :alt="c.name" class="h-full w-full object-contain">
          <svg v-else viewBox="0 0 64 64" fill="none" class="h-full w-full">
            <rect x="6" y="22" width="52" height="34" rx="2" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2" />
            <path d="M6 22 32 8l26 14" fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M32 8v48" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5" />
            <path d="M6 22l26 14 26-14" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.6" />
          </svg>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-display text-base">{{ c.name }}</p>
            <p v-if="c.isLimitedTime" class="text-xs text-rarity-epic">Tidsbegrenset</p>
          </div>
          <p class="font-display text-rarity-uncommon">
            {{ formatKr(c.casePrice) }}<span v-if="c.keyPrice"> + {{ formatKr(c.keyPrice) }} nøkkel</span>
          </p>
        </div>
      </NuxtLink>

      <p v-if="cases && cases.length === 0" class="text-sm text-[var(--gc-text-muted)]">
        Ingen aktive cases akkurat nå.
      </p>
    </div>
  </main>
</template>
