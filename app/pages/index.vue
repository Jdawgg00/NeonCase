<script setup lang="ts">
// Placeholder only — the full landing page (hero, populære cases, nylige
// drops, markedstrender) is built in en senere fase. This page exists so
// Fase 1 has something to load and to link into the auth flow.
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
    <p class="text-sm uppercase tracking-wide text-[var(--gc-text-muted)]">Fase 1 · Grunnlag</p>
    <h1 class="font-display text-4xl leading-tight text-[var(--gc-text)]">
      NeonCrate
    </h1>
    <p class="max-w-prose text-[var(--gc-text-muted)]">
      Et internt, sosialt case-spill med virtuell saldo i kr. Ingen ekte penger, ingen reell
      pengeverdi — kun for moro på kontoret.
    </p>
    <NuxtLink
      to="/login"
      class="inline-flex w-fit items-center rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-5 py-2.5 font-display text-graphite-950 transition hover:brightness-110"
    >
      Logg inn
    </NuxtLink>
  </main>
</template>
