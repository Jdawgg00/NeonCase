<script setup lang="ts">
import { gsap } from 'gsap'
import type { CaseDropOddsDTO, InventoryItemDTO } from '~~/types/dto'

const props = defineProps<{
  /** The case's possible drops — used only to fill the strip with visual variety. */
  possibleDrops: CaseDropOddsDTO[]
  /**
   * The result the server has decided — starts out `null` so the reel can
   * spin from the very first frame, before the network round-trip resolves.
   * The winning card's position is only chosen once this arrives (see
   * startLanding), so what the reel settles on always matches what was
   * actually paid for and awarded.
   */
  result: InventoryItemDTO | null
  /** When true (or prefers-reduced-motion), skip straight to the result. */
  reduceMotion?: boolean
}>()

const emit = defineEmits<{ finished: [] }>()

const CARD_WIDTH = 152 // px, including gap — must match the CSS below

/**
 * Only ~5 cards are ever on screen, so the strip is a short loop rendered
 * twice rather than one enormous run of cards. Two copies of the same
 * sequence means the rendered content repeats exactly every LAP_PX, so the
 * spin can wrap back to the start invisibly and run indefinitely while
 * waiting on the server. (An earlier version used a single 200-card strip
 * to cover the wait — painting that many cards and images stuttered for the
 * first second or two, which read as the reel spinning slowly and then
 * speeding up once it smoothed out.)
 */
const UNIQUE_CARDS = 48
const RENDER_COPIES = 2
const LAP_PX = UNIQUE_CARDS * CARD_WIDTH

/**
 * The spin and the landing are deliberately *the same motion*: an ease-out
 * curve is at its fastest at the start, so if the landing began faster than
 * the spin was travelling, the reel would visibly lurch forward at the
 * handoff.
 *
 * For the ease below — 1-(1-p)³ — the speed at p=0 is exactly
 * 3 × distance / duration. Setting that equal to SPIN_SPEED_PX_S gives
 * duration = 3 × distance / SPIN_SPEED_PX_S, so deceleration starts at
 * precisely the speed the reel was already going. The ease is written out
 * as a function rather than using a named GSAP ease ("power3.out" etc.)
 * because that slope of 3 has to be known exactly for the match to hold.
 */
const SPIN_SPEED_PX_S = 4000
const DECEL_DISTANCE_PX = 3800
const DECEL_EASE = (p: number) => 1 - Math.pow(1 - p, 3)
const DECEL_EASE_INITIAL_SLOPE = 3

function weightedFillerPick(pool: CaseDropOddsDTO[]): CaseDropOddsDTO {
  // Same odds the server actually rolls with — a uniform pick over the list
  // of unique possible drops would make ultra-rare SPECIAL items (dozens of
  // unique knife/glove entries sharing a ~0.26% total slice) show up in the
  // filler constantly, which is exactly backwards from how it should feel.
  const totalWeight = pool.reduce((sum, d) => sum + d.probabilityPercent, 0)
  let roll = Math.random() * totalWeight
  for (const drop of pool) {
    roll -= drop.probabilityPercent
    if (roll <= 0) return drop
  }
  return pool[pool.length - 1]!
}

const trackRef = ref<HTMLElement | null>(null)
const settled = ref(false)
const isLanding = ref(false)
const skipRequested = ref(false)
/** Chosen at landing time, not up front — see startLanding(). */
const winningIndex = ref<number | null>(null)
let landingTween: gsap.core.Tween | null = null
let spinTween: gsap.core.Tween | null = null

function skip() {
  if (landingTween) {
    // Already landing — jump to the end. This still fires onComplete, so
    // settled/finished stay the single source of truth for "spin is over".
    landingTween.progress(1)
    return
  }
  // The result isn't back yet, so there's nowhere to jump to. Flag it (the
  // label reflects this) and startLanding() will place it instantly rather
  // than playing the deceleration once the result does arrive.
  skipRequested.value = true
}

// Rolled once per mount and never regenerated — only the winning slot's
// content changes once the result arrives. Regenerating on every prop
// change would reshuffle cards already on screen mid-spin.
const filler: CaseDropOddsDTO[] = Array.from({ length: UNIQUE_CARDS }, () =>
  weightedFillerPick(props.possibleDrops),
)

const strip = computed<(CaseDropOddsDTO | InventoryItemDTO)[]>(() => {
  const items: (CaseDropOddsDTO | InventoryItemDTO)[] = Array.from(
    { length: UNIQUE_CARDS * RENDER_COPIES },
    (_, i) => filler[i % UNIQUE_CARDS]!,
  )
  if (props.result && winningIndex.value !== null) items[winningIndex.value] = props.result
  return items
})

function itemKey(item: CaseDropOddsDTO | InventoryItemDTO, i: number) {
  return 'skin' in item ? `${item.id}-${i}` : `${item.slug}-${i}`
}
function itemSkin(item: CaseDropOddsDTO | InventoryItemDTO) {
  return 'skin' in item ? item.skin : item
}

function startLanding() {
  const track = trackRef.value
  if (!track) return
  isLanding.value = true

  const container = track.parentElement!
  const centerOffset = container.clientWidth / 2 - CARD_WIDTH / 2

  // Derived from the spin tween's own progress rather than read back off the
  // element: the spin covers exactly LAP_PX per repeat at a constant speed,
  // so this is exact, and it avoids depending on how GSAP formats a
  // transform value when reading it back.
  const currentX = spinTween ? -spinTween.progress() * LAP_PX : 0
  spinTween?.kill()

  // Rather than a fixed winning slot, pick whichever card lands under the
  // marker DECEL_DISTANCE_PX further along from wherever the spin currently
  // is — so the reel only ever continues forward, at the same speed, and the
  // result is swapped into a card still well off-screen to the right.
  const rawTargetX = currentX - DECEL_DISTANCE_PX
  const index = Math.min(
    Math.round((centerOffset - rawTargetX) / CARD_WIDTH),
    UNIQUE_CARDS * RENDER_COPIES - 1,
  )
  winningIndex.value = index

  const targetX = centerOffset - index * CARD_WIDTH
  const distance = currentX - targetX

  if (distance <= 0 || props.reduceMotion || skipRequested.value) {
    gsap.set(track, { x: targetX })
    settled.value = true
    emit('finished')
    return
  }

  landingTween = gsap.fromTo(
    track,
    { x: currentX },
    {
      x: targetX,
      duration: (DECEL_EASE_INITIAL_SLOPE * distance) / SPIN_SPEED_PX_S,
      ease: DECEL_EASE,
      onComplete: () => {
        settled.value = true
        emit('finished')
      },
    },
  )
}

onMounted(() => {
  if (props.reduceMotion || !trackRef.value || props.result) {
    startLanding()
    return
  }

  // Spin at full speed from the first frame — the same speed the landing
  // starts decelerating from, so the two read as one continuous motion.
  // Wraps within a single lap, which is invisible because the rendered
  // strip repeats with exactly that period.
  spinTween = gsap.to(trackRef.value, {
    x: -LAP_PX,
    duration: LAP_PX / SPIN_SPEED_PX_S,
    ease: 'none',
    repeat: -1,
  })
})

watch(
  () => props.result,
  (result: InventoryItemDTO | null) => {
    if (result && !isLanding.value) startLanding()
  },
)
</script>

<template>
  <div class="relative overflow-hidden rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 py-4">
    <!-- center marker -->
    <div class="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-rarity-uncommon" />

    <div ref="trackRef" class="flex gap-2 will-change-transform">
      <div
        v-for="(item, i) in strip"
        :key="itemKey(item, i)"
        class="flex h-36 w-36 flex-shrink-0 flex-col items-center justify-between rounded-[var(--gc-radius-md)] border p-3"
        :class="[
          `rarity-panel-${itemSkin(item).rarity.toLowerCase()}`,
          settled && i === winningIndex ? 'ring-2 ring-rarity-uncommon shadow-[0_0_24px_-4px_var(--gc-uncommon)]' : '',
        ]"
      >
        <div class="h-16 w-16 rounded-[var(--gc-radius-sm)] bg-graphite-950/60">
          <SkinSwatch
            :seed="'patternSeed' in item ? item.patternSeed : itemSkin(item).id"
            :rarity="itemSkin(item).rarity"
            :category="itemSkin(item).weaponCategory"
            :image-url="itemSkin(item).imageUrl"
            :name="itemSkin(item).name"
          />
        </div>
        <p class="line-clamp-1 text-center text-xs text-[var(--gc-text)]">{{ itemSkin(item).name }}</p>
        <RarityBadge :rarity="itemSkin(item).rarity" size="sm" />
      </div>
    </div>

    <button
      v-if="!settled"
      type="button"
      :disabled="skipRequested && !isLanding"
      class="absolute bottom-3 right-3 z-10 rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950/80 px-3 py-1.5 text-xs text-[var(--gc-text)] backdrop-blur transition hover:border-rarity-uncommon disabled:opacity-60"
      @click="skip"
    >
      {{ skipRequested && !isLanding ? 'Venter på resultat…' : 'Hopp over ⏭' }}
    </button>
  </div>
</template>
