<script setup lang="ts">
const props = defineProps<{
  seed: string | number
  rarity: string
  category: string
  imageUrl?: string | null
  name: string
}>()

const pattern = computed(() => useSkinPattern(props.seed, props.rarity))
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-[var(--gc-radius-sm)]" :class="`rarity-${rarity.toLowerCase()}`">
    <img v-if="imageUrl" :src="imageUrl" :alt="name" class="h-full w-full object-contain">
    <template v-else>
      <div class="absolute inset-0" :style="pattern.style" />
      <div class="relative flex h-full w-full items-center justify-center p-2.5">
        <WeaponIcon :category="category" />
      </div>
    </template>
  </div>
</template>
