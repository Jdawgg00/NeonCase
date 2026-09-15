import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const total = await p.skinDefinition.count()
const priced = await p.skinDefinition.count({ where: { steamPriceCents: { not: null } } })
const latest = await p.skinDefinition.findFirst({
  where: { steamPriceUpdatedAt: { not: null } },
  orderBy: { steamPriceUpdatedAt: 'desc' },
  select: { name: true, steamPriceCents: true, steamPriceUpdatedAt: true },
})
console.log(`Skins priced: ${priced}/${total}`)
console.log(`Latest: ${latest?.steamPriceUpdatedAt?.toISOString()} — ${latest?.name} (${latest?.steamPriceCents} øre)`)

const cases = await p.caseDefinition.findMany({ select: { name: true, casePrice: true, keyPrice: true }, orderBy: { casePrice: 'asc' } })
console.log('\nCase prices:')
for (const c of cases) console.log(`  ${c.casePrice} kr${c.keyPrice ? ` + ${c.keyPrice} kr key` : ''} — ${c.name}`)

await p.$disconnect()
