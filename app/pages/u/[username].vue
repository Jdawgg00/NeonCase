<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const username = route.params.username as string

interface ProfileResponse {
  username: string
  memberSince: string
  publicProfile: boolean
  inventoryValue: number
  caseOpeningsCount: number
  bestDrop: { name: string; rarity: string; value: number } | null
  tradeVolume: number
  achievementsCount: number
}

const { data: profile, error } = await useFetch<ProfileResponse>(`/api/users/${username}`)
</script>

<template>
  <main class="mx-auto max-w-xl px-6 py-12">
    <p v-if="error" class="text-sm text-[var(--gc-text-muted)]">Fant ikke profilen, eller den er privat.</p>

    <template v-else-if="profile">
      <h1 class="mb-1 font-display text-2xl">{{ profile.username }}</h1>
      <p class="mb-6 text-xs text-[var(--gc-text-muted)]">Medlem siden {{ new Date(profile.memberSince).toLocaleDateString('nb-NO') }}</p>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-xs text-[var(--gc-text-muted)]">Inventory-verdi</p>
          <p class="font-display text-lg text-rarity-uncommon">{{ formatKr(profile.inventoryValue) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-xs text-[var(--gc-text-muted)]">Åpninger</p>
          <p class="font-display text-lg">{{ profile.caseOpeningsCount }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-xs text-[var(--gc-text-muted)]">Handelsvolum</p>
          <p class="font-display text-lg">{{ formatKr(profile.tradeVolume) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-xs text-[var(--gc-text-muted)]">Achievements</p>
          <p class="font-display text-lg">{{ profile.achievementsCount }}</p>
        </div>
        <div v-if="profile.bestDrop" class="col-span-2 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
          <p class="text-xs text-[var(--gc-text-muted)]">Beste drop</p>
          <p class="font-display text-lg" :class="`rarity-${profile.bestDrop.rarity.toLowerCase()}`">{{ profile.bestDrop.name }}</p>
        </div>
      </div>
    </template>
  </main>
</template>
