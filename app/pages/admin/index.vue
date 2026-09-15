<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

interface EconomyReport {
  totalCreditsInCirculation: number
  averageBalance: number
  creditsCreated24h: number
  creditsRemoved24h: number
  caseOpenings24h: number
  marketVolume24h: number
  averageMarketPrice24h: number
  activeUsers: number
}
interface AdminCase {
  id: string
  slug: string
  name: string
  casePrice: number
  keyPrice: number | null
  status: string
  latestVersion: { version: number; publishedAt: string | null } | null
}
interface AdminSkin {
  id: string
  slug: string
  name: string
  weaponCategory: string
  rarity: string
  baseReferenceValue: number
}
interface AdminUser {
  id: string
  username: string
  email: string
  role: string
  status: string
}
interface AuditLogEntry {
  id: string
  action: string
  actor: string | null
  target: string | null
  reason: string | null
  createdAt: string
}

const { data: economy } = await useFetch<EconomyReport>('/api/admin/economy')
const { data: cases, refresh: refreshCases } = await useFetch<AdminCase[]>('/api/admin/cases')
const { data: skins, refresh: refreshSkins } = await useFetch<AdminSkin[]>('/api/admin/skins')
const { data: users, refresh: refreshUsers } = await useFetch<AdminUser[]>('/api/admin/users')
const { data: auditLog } = await useFetch<AuditLogEntry[]>('/api/admin/audit-log')

// --- Case status ---
async function setCaseStatus(c: AdminCase, status: string) {
  await $fetch(`/api/admin/cases/${c.id}/status`, { method: 'PATCH', body: { status } })
  await refreshCases()
}

// --- Publish new version ---
const publishingCaseId = ref<string | null>(null)
const weightsByCaseSkin = ref<Record<string, number>>({}) // key: `${caseId}:${skinId}`
const publishError = ref('')

function weightKey(caseId: string, skinId: string) {
  return `${caseId}:${skinId}`
}

async function publishVersion(caseId: string) {
  publishError.value = ''
  const drops = (skins.value ?? [])
    .map((s) => ({ skinDefinitionId: s.id, weight: weightsByCaseSkin.value[weightKey(caseId, s.id)] ?? 0 }))
    .filter((d) => d.weight > 0)

  if (drops.length === 0) {
    publishError.value = 'Sett minst én vekt > 0 før du publiserer.'
    return
  }

  try {
    await $fetch(`/api/admin/cases/${caseId}/publish`, { method: 'POST', body: { drops } })
    publishingCaseId.value = null
    await refreshCases()
  } catch (err: unknown) {
    publishError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Publisering feilet.'
  }
}

// --- Create skin ---
const newSkin = ref({ slug: '', name: '', weaponCategory: 'RIFLES', rarity: 'COMMON', baseReferenceValue: 100 })
const skinError = ref('')
async function createSkin() {
  skinError.value = ''
  try {
    await $fetch('/api/admin/skins', { method: 'POST', body: newSkin.value })
    newSkin.value = { slug: '', name: '', weaponCategory: 'RIFLES', rarity: 'COMMON', baseReferenceValue: 100 }
    await refreshSkins()
  } catch (err: unknown) {
    skinError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kunne ikke opprette skin.'
  }
}

// --- Create case ---
const newCase = ref({ slug: '', name: '', description: '', casePrice: 500, keyPrice: undefined as number | undefined })
const caseError = ref('')
async function createCase() {
  caseError.value = ''
  try {
    await $fetch('/api/admin/cases', { method: 'POST', body: newCase.value })
    newCase.value = { slug: '', name: '', description: '', casePrice: 500, keyPrice: undefined }
    await refreshCases()
  } catch (err: unknown) {
    caseError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kunne ikke opprette case.'
  }
}

// --- Suspend user ---
const suspendTarget = ref<AdminUser | null>(null)
const suspendReason = ref('')
const suspendStatus = ref<'SUSPENDED' | 'BANNED' | 'ACTIVE'>('SUSPENDED')
const suspendError = ref('')

async function submitSuspend() {
  if (!suspendTarget.value) return
  suspendError.value = ''
  try {
    await $fetch(`/api/admin/users/${suspendTarget.value.id}/suspend`, {
      method: 'POST',
      body: { status: suspendStatus.value, reason: suspendReason.value },
    })
    suspendTarget.value = null
    suspendReason.value = ''
    await refreshUsers()
  } catch (err: unknown) {
    suspendError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Kunne ikke oppdatere status.'
  }
}
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-12 px-6 py-12">
    <h1 class="font-display text-2xl">Admin</h1>

    <!-- Economy dashboard -->
    <section>
      <h2 class="mb-3 font-display text-lg">Økonomi (siste 24t)</h2>
      <div v-if="economy" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Kr i omløp</p>
          <p class="font-display text-lg text-rarity-uncommon">{{ formatKr(economy.totalCreditsInCirculation) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Snittsaldo</p>
          <p class="font-display text-lg">{{ formatKr(economy.averageBalance) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Opprettet</p>
          <p class="font-display text-lg text-rarity-uncommon">+{{ formatKr(economy.creditsCreated24h) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Fjernet</p>
          <p class="font-display text-lg text-rarity-epic">-{{ formatKr(economy.creditsRemoved24h) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Case-åpninger</p>
          <p class="font-display text-lg">{{ economy.caseOpenings24h }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Markedsomsetning</p>
          <p class="font-display text-lg">{{ formatKr(economy.marketVolume24h) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Snitt markedspris</p>
          <p class="font-display text-lg">{{ formatKr(economy.averageMarketPrice24h) }}</p>
        </div>
        <div class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-3">
          <p class="text-xs text-[var(--gc-text-muted)]">Aktive brukere</p>
          <p class="font-display text-lg">{{ economy.activeUsers }}</p>
        </div>
      </div>
    </section>

    <!-- Cases -->
    <section>
      <h2 class="mb-3 font-display text-lg">Cases</h2>

      <div class="mb-4 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
        <p class="mb-2 text-sm">Opprett ny case</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input v-model="newCase.slug" placeholder="slug" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
          <input v-model="newCase.name" placeholder="Navn" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
          <input v-model="newCase.description" placeholder="Beskrivelse" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm sm:col-span-2">
          <input v-model.number="newCase.casePrice" type="number" placeholder="Pris" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
        </div>
        <button type="button" class="mt-2 rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-3 py-1.5 text-xs font-display text-graphite-950" @click="createCase">
          Opprett (status: DRAFT)
        </button>
        <p v-if="caseError" class="mt-2 text-xs text-rarity-epic">{{ caseError }}</p>
      </div>

      <div v-for="c in cases" :key="c.id" class="mb-3 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-display">{{ c.name }} <span class="text-xs text-[var(--gc-text-muted)]">({{ c.slug }})</span></p>
            <p class="text-xs text-[var(--gc-text-muted)]">
              Status: {{ c.status }} · Publisert versjon: {{ c.latestVersion?.publishedAt ? `v${c.latestVersion.version}` : 'ingen' }}
              · Pris: {{ formatKr(c.casePrice) }}<span v-if="c.keyPrice"> + {{ formatKr(c.keyPrice) }} nøkkel</span>
            </p>
          </div>
          <div class="flex gap-2">
            <select :value="c.status" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1 text-xs" @change="setCaseStatus(c, ($event.target as HTMLSelectElement).value)">
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <button type="button" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] px-2 py-1 text-xs" @click="publishingCaseId = publishingCaseId === c.id ? null : c.id">
              {{ publishingCaseId === c.id ? 'Lukk' : 'Publiser ny versjon' }}
            </button>
          </div>
        </div>

        <div v-if="publishingCaseId === c.id" class="mt-3 border-t border-[var(--gc-steel-700)] pt-3">
          <p class="mb-2 text-xs text-[var(--gc-text-muted)]">Sett vekt (heltall) for skins som skal være med. 0 = ikke med.</p>
          <div class="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            <label v-for="s in skins" :key="s.id" class="flex items-center justify-between gap-2 text-xs">
              <span class="truncate" :class="`rarity-${s.rarity.toLowerCase()}`">{{ s.name }}</span>
              <input
                v-model.number="weightsByCaseSkin[weightKey(c.id, s.id)]"
                type="number"
                min="0"
                class="w-20 rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-1.5 py-1"
              >
            </label>
          </div>
          <button type="button" class="mt-3 rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-3 py-1.5 text-xs font-display text-graphite-950" @click="publishVersion(c.id)">
            Publiser
          </button>
          <p v-if="publishError" class="mt-2 text-xs text-rarity-epic">{{ publishError }}</p>
        </div>
      </div>
    </section>

    <!-- Skins -->
    <section>
      <h2 class="mb-3 font-display text-lg">Skins</h2>
      <div class="mb-4 rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-4">
        <p class="mb-2 text-sm">Opprett ny skin</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input v-model="newSkin.slug" placeholder="slug" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
          <input v-model="newSkin.name" placeholder="Navn" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
          <select v-model="newSkin.weaponCategory" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
            <option v-for="c in ['RIFLES', 'PRECISION', 'SIDEARMS', 'COMPACT', 'HEAVY', 'BLADES']" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="newSkin.rarity" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
            <option v-for="r in ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'SPECIAL']" :key="r" :value="r">{{ r }}</option>
          </select>
          <input v-model.number="newSkin.baseReferenceValue" type="number" placeholder="Verdi" class="rounded-[var(--gc-radius-sm)] border border-[var(--gc-steel-700)] bg-graphite-950 px-2 py-1.5 text-sm">
        </div>
        <button type="button" class="mt-2 rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-3 py-1.5 text-xs font-display text-graphite-950" @click="createSkin">
          Opprett
        </button>
        <p v-if="skinError" class="mt-2 text-xs text-rarity-epic">{{ skinError }}</p>
      </div>
      <p class="text-xs text-[var(--gc-text-muted)]">{{ skins?.length ?? 0 }} skins totalt.</p>
    </section>

    <!-- Users -->
    <section>
      <h2 class="mb-3 font-display text-lg">Brukere</h2>
      <ul class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)]">
        <li v-for="u in users" :key="u.id" class="flex items-center justify-between px-4 py-2 text-sm">
          <span>{{ u.username }} <span class="text-xs text-[var(--gc-text-muted)]">({{ u.role }} · {{ u.status }})</span></span>
          <button type="button" class="text-xs text-rarity-epic hover:underline" @click="suspendTarget = u; suspendStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'">
            {{ u.status === 'ACTIVE' ? 'Suspender' : 'Reaktiver' }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Audit log -->
    <section>
      <h2 class="mb-3 font-display text-lg">Audit-logg</h2>
      <ul class="divide-y divide-[var(--gc-steel-700)] rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] text-sm">
        <li v-for="entry in auditLog" :key="entry.id" class="px-4 py-2">
          <p>{{ entry.action }} — {{ entry.actor ?? 'system' }}<span v-if="entry.target"> → {{ entry.target }}</span></p>
          <p v-if="entry.reason" class="text-xs text-[var(--gc-text-muted)]">{{ entry.reason }}</p>
        </li>
      </ul>
    </section>

    <!-- Suspend dialog -->
    <div v-if="suspendTarget" class="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-900 p-5">
        <p class="mb-2 font-display">{{ suspendStatus === 'ACTIVE' ? 'Reaktiver' : 'Suspender' }} {{ suspendTarget.username }}</p>
        <textarea
          v-model="suspendReason"
          placeholder="Begrunnelse (minst 10 tegn) — logges i audit-loggen"
          class="mb-2 w-full rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] bg-graphite-950 px-3 py-2 text-sm"
        />
        <p v-if="suspendError" class="mb-2 text-xs text-rarity-epic">{{ suspendError }}</p>
        <div class="flex gap-2">
          <button type="button" class="rounded-[var(--gc-radius-md)] bg-rarity-uncommon px-4 py-2 text-sm font-display text-graphite-950" @click="submitSuspend">
            Bekreft
          </button>
          <button type="button" class="rounded-[var(--gc-radius-md)] border border-[var(--gc-steel-700)] px-4 py-2 text-sm" @click="suspendTarget = null">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
