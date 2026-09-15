<script setup lang="ts">
import { displayNameSchema } from '~~/types/schemas/auth'

const { signIn } = useAuth()

const name = ref('')
const state = ref<'idle' | 'submitting' | 'error'>('idle')
const errorMessage = ref('')

async function continueWithName() {
  const parsed = displayNameSchema.safeParse(name.value)
  if (!parsed.success) {
    state.value = 'error'
    errorMessage.value = parsed.error.issues[0]?.message ?? 'Ugyldig navn'
    return
  }

  state.value = 'submitting'
  errorMessage.value = ''

  // redirect: false so a rejected name can be shown inline instead of
  // bouncing to Auth.js's own error page.
  const result = await signIn('name', { username: parsed.data, redirect: false })

  if (result?.error) {
    state.value = 'error'
    errorMessage.value = 'Kunne ikke logge inn med det navnet. Prøv et annet.'
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
    <div>
      <h1 class="font-display text-2xl text-[var(--gc-text)]">Hva heter du?</h1>
      <p class="mt-2 text-sm text-[var(--gc-text-muted)]">
        Navnet ditt blir husket på denne maskinen, så saldo, inventory og statistikk
        er der neste gang du spiller. Skriv inn det samme navnet for å fortsette der du slapp.
      </p>
    </div>

    <form class="flex flex-col gap-3" @submit.prevent="continueWithName">
      <input
        v-model="name"
        type="text"
        required
        autofocus
        autocomplete="nickname"
        maxlength="24"
        placeholder="Navnet ditt"
        data-testid="name-login-input"
        class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 px-3 py-2.5 text-[var(--gc-text)] placeholder:text-[var(--gc-text-muted)]"
      >

      <button
        type="submit"
        :disabled="state === 'submitting'"
        data-testid="name-login-submit"
        class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2.5 font-display text-graphite-950 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ state === 'submitting' ? 'Logger inn…' : 'Spill' }}
      </button>

      <p v-if="state === 'error'" data-testid="name-login-error" class="text-sm text-rarity-epic">
        {{ errorMessage }}
      </p>
    </form>

    <p class="text-xs text-[var(--gc-text-muted)]">
      Virtuell saldo i kr — ingen ekte penger, ingen reell verdi.
    </p>
  </main>
</template>
