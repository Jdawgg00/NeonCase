<script setup lang="ts">
const props = defineProps<{
  name: string
  rarity: string
  category: string
  imageUrl?: string | null
  seed: string | number
  floatValue?: number
  wear?: string
  steamPriceCents?: number | null
  steamPriceCurrency?: string | null
  steamVolume?: number | null
  baseReferenceValue?: number
}>()

const emit = defineEmits<{ close: [] }>()

const pattern = computed(() => useSkinPattern(props.seed, props.rarity))

// Mouse-driven tilt — bounded so it reads as "inspecting" rather than
// flipping the card over. Resets to a gentle idle drift when the pointer
// leaves, so the panel never just sits dead flat.
const MAX_TILT_DEG = 14
const stageRef = ref<HTMLElement | null>(null)
const rotateX = ref(0)
const rotateY = ref(0)
const hovering = ref(false)

function onPointerMove(e: PointerEvent) {
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  const px = (e.clientX - rect.left) / rect.width // 0..1
  const py = (e.clientY - rect.top) / rect.height // 0..1
  rotateY.value = (px - 0.5) * 2 * MAX_TILT_DEG
  rotateX.value = (0.5 - py) * 2 * MAX_TILT_DEG
}

function onPointerLeave() {
  hovering.value = false
  rotateX.value = 0
  rotateY.value = 0
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-5">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <p class="font-display text-lg leading-tight">{{ name }}</p>
          <RarityBadge :rarity="rarity" size="sm" />
        </div>
        <button
          type="button"
          aria-label="Lukk"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--gc-text-muted)] hover:text-[var(--gc-text)]"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div
        ref="stageRef"
        class="relative h-64 select-none overflow-hidden rounded-[var(--gc-radius-md)] bg-graphite-950/60 [perspective:900px]"
        :class="`rarity-panel-${rarity.toLowerCase()}`"
        @pointerenter="hovering = true"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
      >
        <div
          class="h-full w-full transition-transform duration-150 ease-out will-change-transform"
          :class="{ 'animate-[inspect-idle_6s_ease-in-out_infinite]': !hovering }"
          :style="{ transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)` }"
        >
          <img v-if="imageUrl" :src="imageUrl" :alt="name" class="h-full w-full object-contain p-6">
          <template v-else>
            <div class="absolute inset-0" :style="pattern.style" />
            <div class="relative flex h-full w-full items-center justify-center p-10">
              <WeaponIcon :category="category" />
            </div>
          </template>
        </div>
      </div>

      <p v-if="floatValue !== undefined" class="mt-3 text-sm text-[var(--gc-text-muted)]">
        Float {{ floatValue.toFixed(4) }} <span v-if="wear">· {{ wear }}</span>
      </p>
      <p v-if="baseReferenceValue !== undefined" class="mt-1 text-sm text-[var(--gc-text)]">
        {{ priceOrEstimate(steamPriceCents ?? null, steamPriceCurrency ?? null, baseReferenceValue).estimated ? 'Estimert pris' : 'Steam-pris' }}:
        {{ priceOrEstimate(steamPriceCents ?? null, steamPriceCurrency ?? null, baseReferenceValue).text }}
        <span v-if="steamVolume" class="text-[var(--gc-text-muted)]">· {{ steamVolume.toLocaleString('nb-NO') }} solgt nylig</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes inspect-idle {
  0%, 100% { transform: rotateX(2deg) rotateY(-6deg) scale3d(1.05, 1.05, 1.05); }
  50% { transform: rotateX(-2deg) rotateY(6deg) scale3d(1.05, 1.05, 1.05); }
}
</style>
