<script setup lang="ts">
import type { WalletDTO, WalletTransactionDTO } from '~~/types/dto'

definePageMeta({ middleware: 'auth' })

const { data: session, signOut } = useAuth()

const { data: wallet, refresh: refreshWallet } = await useWallet()
const { data: transactions, refresh: refreshTransactions } = await useFetch<WalletTransactionDTO[]>('/api/wallet/transactions')

type ClaimState = 'idle' | 'loading' | 'success' | 'error'
const claimState = ref<ClaimState>('idle')
const claimError = ref('')

async function claimDailyBonus() {
  claimState.value = 'loading'
  claimError.value = ''
  try {
    await $fetch<WalletDTO>('/api/wallet/daily-bonus', { method: 'POST' })
    await Promise.all([refreshWallet(), refreshTransactions()])
    claimState.value = 'success'
  } catch (err: unknown) {
    claimState.value = 'error'
    claimError.value =
      (err as { statusMessage?: string; data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Kunne ikke hente daglig bonus. Prøv igjen.'
  }
}

const TRANSACTION_LABELS: Record<string, string> = {
  STARTING_BALANCE: 'Startsaldo',
  DAILY_BONUS: 'Daglig bonus',
  ADMIN_ADJUSTMENT_CREDIT: 'Admin-justering',
  ADMIN_ADJUSTMENT_DEBIT: 'Admin-justering',
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-12">
    <header class="mb-8 flex items-center justify-between">
      <div>
        <p class="text-sm text-[var(--gc-text-muted)]">Innlogget som</p>
        <p class="font-display text-lg">{{ session?.user?.username }}</p>
      </div>
      <button class="text-sm text-[var(--gc-text-muted)] underline-offset-4 hover:underline" @click="signOut({ callbackUrl: '/login' })">
        Logg ut
      </button>
    </header>

    <section class="mb-8 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-6">
      <p class="text-sm text-[var(--gc-text-muted)]">Saldo</p>
      <p data-testid="wallet-balance" class="font-display text-4xl text-rarity-uncommon">{{ formatKr(wallet?.balance ?? 0) }}</p>

      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="claim-daily-bonus"
          class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2 font-display text-graphite-950 transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="claimState === 'loading'"
          @click="claimDailyBonus"
        >
          {{ claimState === 'loading' ? 'Henter…' : 'Hent daglig bonus' }}
        </button>

        <NuxtLink
          to="/cases"
          class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 font-display text-[var(--gc-text)] transition hover:border-rarity-uncommon"
        >
          Begynn å åpne cases
        </NuxtLink>
      </div>

      <p v-if="claimState === 'success'" data-testid="claim-success" class="mt-2 text-sm text-rarity-uncommon">Daglig bonus lagt til saldoen.</p>
      <p v-if="claimState === 'error'" data-testid="claim-error" class="mt-2 text-sm text-rarity-epic">{{ claimError }}</p>
    </section>

    <section class="mb-8">
      <h2 class="mb-3 font-display text-lg">Siste transaksjoner</h2>
      <ul class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
        <li
          v-for="tx in transactions"
          :key="tx.id"
          class="flex items-center justify-between px-4 py-3 text-sm"
        >
          <span>{{ TRANSACTION_LABELS[tx.type] ?? tx.type }}</span>
          <span :class="tx.amount >= 0 ? 'text-rarity-uncommon' : 'text-rarity-epic'">
            {{ tx.amount >= 0 ? '+' : '' }}{{ formatKr(tx.amount) }}
          </span>
        </li>
        <li v-if="transactions && transactions.length === 0" class="px-4 py-3 text-sm text-[var(--gc-text-muted)]">
          Ingen transaksjoner ennå.
        </li>
      </ul>
    </section>

    <LiveFeed />
  </main>
</template>
