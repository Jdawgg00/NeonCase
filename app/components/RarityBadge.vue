<script setup lang="ts">
defineProps<{ rarity: string; size?: 'sm' | 'md' }>()

const LABELS: Record<string, string> = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  EPIC: 'Epic',
  SPECIAL: 'Special',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-[var(--gc-radius-sm)] px-2 py-0.5 font-display text-xs"
    :class="[`rarity-${rarity.toLowerCase()}`, size === 'sm' ? 'text-[10px]' : 'text-xs']"
  >
    <span class="h-2.5 w-2.5 [clip-path:var(--tw-clip-path-hex)] bg-current" style="--tw-clip-path-hex: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" />
    {{ LABELS[rarity] ?? rarity }}
  </span>
</template>
