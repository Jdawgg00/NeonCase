<script setup lang="ts">
// Stylized silhouettes, not real weapon art — one shape per weaponCategory,
// filled with currentColor so callers control color via text-* classes.
defineProps<{ category: string }>()
</script>

<template>
  <svg v-if="category === 'RIFLES'" viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <polygon points="4,11 16,9 16,17 6,18" />
    <rect x="14" y="8" width="32" height="8" rx="1" />
    <rect x="44" y="11" width="18" height="3" />
    <rect x="27" y="4" width="7" height="4" />
    <polygon points="18,16 25,16 23,27 17,26" />
    <polygon points="26,16 34,16 31,28 27,27" />
  </svg>

  <svg v-else-if="category === 'PRECISION'" viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <polygon points="2,11 16,9 16,17 4,18" />
    <rect x="16" y="9" width="26" height="6" rx="1" />
    <rect x="40" y="12" width="22" height="2.5" />
    <rect x="24" y="3" width="16" height="4" rx="1" />
    <rect x="27" y="7" width="2" height="3" />
    <rect x="36" y="7" width="2" height="3" />
    <polygon points="20,15 25,15 23,26 18,25" />
  </svg>

  <svg v-else-if="category === 'SIDEARMS'" viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <rect x="10" y="8" width="28" height="6" rx="1" />
    <rect x="36" y="9.5" width="9" height="3" />
    <rect x="14" y="6" width="10" height="3" rx="1" />
    <polygon points="14,14 24,14 22,27 14,26" />
  </svg>

  <svg v-else-if="category === 'COMPACT'" viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <rect x="12" y="8" width="26" height="7" rx="1" />
    <rect x="36" y="9.5" width="10" height="3" />
    <rect x="2" y="10" width="11" height="3" />
    <polygon points="20,15 28,15 26,28 21,27" />
    <polygon points="14,15 19,15 18,24 14,23" />
  </svg>

  <svg v-else-if="category === 'HEAVY'" viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <rect x="10" y="7" width="34" height="9" rx="2" />
    <rect x="44" y="9" width="16" height="4" />
    <circle cx="24" cy="20" r="7" />
    <polygon points="46,16 50,27 46,27" />
    <polygon points="53,16 57,27 53,27" />
    <polygon points="14,16 19,16 17,27 13,26" />
  </svg>

  <svg v-else-if="category === 'BLADES'" viewBox="0 0 32 32" fill="currentColor" class="h-full w-full">
    <g transform="rotate(45 16 16)">
      <polygon points="2,15 24,15 24,17 2,17" />
      <rect x="22" y="11" width="3" height="10" />
      <rect x="24" y="13" width="8" height="6" rx="1" />
    </g>
  </svg>

  <svg v-else viewBox="0 0 64 32" fill="currentColor" class="h-full w-full">
    <rect x="12" y="12" width="40" height="8" rx="2" />
  </svg>
</template>
