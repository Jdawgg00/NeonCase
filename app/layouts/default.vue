<script setup lang="ts">
import type { WalletDTO } from '~~/types/dto'

const { data: session, signOut } = useAuth()

// This layout also wraps the public login/landing pages, which have no
// session — only actually fire the auth-required wallet fetch once one
// shows up, instead of a guaranteed-401 request on every public page load.
// Uses the same 'wallet-balance' key as useWallet() elsewhere, so refreshing
// there updates this display too.
const { data: wallet, execute: fetchWallet } = await useFetch<WalletDTO>('/api/wallet/balance', {
  key: 'wallet-balance',
  immediate: false,
})
watch(
  () => Boolean(session.value?.user),
  (loggedIn: boolean) => {
    if (loggedIn) fetchWallet()
  },
  { immediate: true },
)

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/cases', label: 'Cases' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/market', label: 'Marked' },
  { to: '/leaderboards', label: 'Leaderboards' },
]
</script>

<template>
  <div>
    <nav v-if="session?.user" class="border-b border-[var(--gc-steel-700)] bg-graphite-900">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div class="flex items-center gap-5">
          <span class="font-display text-sm text-rarity-uncommon">NeonCrate</span>
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="text-sm text-[var(--gc-text-muted)] hover:text-[var(--gc-text)]">
            {{ link.label }}
          </NuxtLink>
          <NuxtLink v-if="session.user.role === 'ADMIN'" to="/admin" class="text-sm text-rarity-epic hover:text-[var(--gc-text)]">
            Admin
          </NuxtLink>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/dashboard" class="font-display text-sm text-rarity-uncommon" data-testid="nav-wallet-balance">
            {{ formatKr(wallet?.balance ?? 0) }}
          </NuxtLink>
          <NuxtLink :to="`/u/${session.user.username}`" class="text-sm text-[var(--gc-text-muted)] hover:text-[var(--gc-text)]">
            {{ session.user.username }}
          </NuxtLink>
          <button class="text-sm text-[var(--gc-text-muted)] hover:underline" @click="signOut({ callbackUrl: '/login' })">Logg ut</button>
        </div>
      </div>
    </nav>
    <slot />
  </div>
</template>
