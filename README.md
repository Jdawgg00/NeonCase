# NeonCrate

Internt, sosialt case-opening-spill for kontoret. **Kun virtuelle credits — ingen ekte
penger, ingen uttak, ingen reell verdi.** Designsystem i `DESIGN.md`.

## Status

- ✅ **Fase 1 — Grunnlag**
- ✅ **Fase 2 — Kjerneøkonomi** (wallet, daglig bonus, admin-justeringer, ledger)
- ✅ **Fase 3 — Cases** (RNG, 50 skins, 5 cases, 15-stegs åpne-transaksjon, GSAP-hjul)
- ✅ **Fase 4 — Inventory og marked** (atomisk kjøp, sanntid via WebSocket)
- ✅ **Fase 5 — Sosialt** (achievements, missions, leaderboards, notifications, profil)
- ✅ **Fase 6 — Admin og analytics** (case/skin CRUD, versjonering, moderering, økonomidashboard, audit-logg)
- ⬜ Fase 7 — Kvalitet (mer testdekning, full Playwright-suite, tilgjengelighet/ytelse/sikkerhetsgjennomgang)

## Hva er faktisk verifisert vs. bare skrevet

Jeg bygget dette i et sandkassemiljø uten nettverkstilgang til Prismas
binærfil-CDN (`binaries.prisma.sh`), så `prisma generate`/`migrate dev` kunne aldri kjøres
her — se advarselen under "Kom i gang". Alt annet er reelt verifisert i miljøet mitt:

- **`npm run typecheck` er rent** bortsett fra feil som er 100 % sporbare til den
  manglende Prisma-klienten (manglende enums/typer som *finnes* i schemaet og dukker opp
  automatisk etter `prisma generate`). Ingen andre typefeil.
- **RNG-en er faktisk kjørt 1 million ganger** (`tests/unit/rng.test.ts`) og traff de
  konfigurerte oddsene innenfor toleranse.
- **All seed-data er verifisert** (`tests/unit/case-seed-data.test.ts`): 50+ skins med
  riktig rarity-fordeling, 5 cases med 10–20 skins hver, og hver eneste case sine
  drop-vekter summerer til **nøyaktig** 10 000 (100,00 %).
- **Wallet- og market-testene** (`tests/unit/{wallet,market}.service.test.ts`) er ekte
  integrasjonstester mot Postgres — skrevet og gjennomgått, men *ikke kjørt* her siden det
  krever en levende database jeg ikke har tilgang til i sandkassen. Kjør dem hos deg med
  `npm run test` etter `docker compose up -d`.

## Kom i gang lokalt

```bash
cp .env.example .env          # fyll inn AUTH_SECRET og ev. OAuth-nøkler
docker compose up -d          # Postgres + Redis
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

> **Om Prisma i utviklingsmiljøet mitt:** se forrige seksjon. Kjør `npm run typecheck`
> hos deg rett etter `prisma generate` for å bekrefte at alt er rent — si ifra hvis noe
> likevel feiler.

## Arkitektur (kort)

- **Økonomisk sannhet ett sted**: `applyBalanceDeltaTx` i `wallet.service.ts` er den
  eneste koden som noen gang skriver til `Wallet.balance`. Case-opening og
  market-kjøp importerer og gjenbruker den samme funksjonen inni sine egne
  transaksjoner — det finnes ikke en andre, parallell måte å endre saldo på.
- **Konkurransesikkerhet uten eksplisitte låser**: alle steder hvor "bare én skal vinne"
  betyr noe (wallet-oppdatering, markedskjøp, lås/lås-opp av inventory) bruker samme
  mønster — en betinget `updateMany` (`WHERE id = ? AND version/status = forventet`) og
  sjekker `count === 1`. Ingen `SELECT ... FOR UPDATE`, ingen eksterne låsetjenester.
- **Odds er aldri hardkodet i frontend**: `CaseDrop.weight` (heltall) ligger i databasen
  per `CaseVersion`; frontend får kun beregnede, publiserte prosenter fra API-et.
- **Case-versjonering**: å publisere nye odds (`admin.service.publishNewVersion`) lager
  alltid en *ny* `CaseVersion` — historiske `CaseOpening`-rader peker fortsatt på
  versjonen de faktisk ble trukket mot.
- **Sosiale hooks er non-fatal**: achievement/mission-sjekker etter en case-åpning eller
  et salg kjører i `try/catch` *utenfor* den økonomiske transaksjonen — en feil der kan
  aldri rulle tilbake eller blokkere noe spilleren allerede har betalt for og mottatt.

## Testing

```bash
npm run typecheck   # vue-tsc, strict — rent bortsett fra Prisma-stub-feilene over
npm run test        # Vitest — rng.test.ts og case-seed-data.test.ts trenger ingen DB;
                     # wallet/market-testene trenger DATABASE_URL mot en ekte database
npm run test:e2e    # Playwright — krever kjørende dev-server + seedet database
```

`tests/unit/rng.test.ts` og `tests/unit/case-seed-data.test.ts` er ren logikk/data og kan
kjøres akkurat som de er, hvor som helst, uten oppsett.

## Kommandoer
| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Utviklingsserver |
| `npm run typecheck` | `nuxt typecheck` |
| `npm run test` / `test:e2e` | Vitest / Playwright |
| `npm run db:migrate` | Ny Prisma-migrasjon |
| `npm run db:seed` | Kjør `prisma/seed.ts` (admin + 20 testbrukere + 50 skins + 5 cases + achievements/missions) |
| `npm run db:studio` | Prisma Studio |

Etter seeding: logg inn som `admin@neoncrate.local` (dev-credentials, se `.env.example`
for `DEV_PASSWORD_HASH`) for tilgang til `/admin`.

## Fase 7 — det som gjenstår
- Flere DB-baserte unit-tester (f.eks. "case-versjonering bevarer historiske odds" som en
  eksplisitt regresjonstest, ikke bare implisitt av designet).
- Playwright-dekning av spesifikasjonens resterende 7 E2E-scenarioer (konto → case →
  inventory → marked → tofaktor-salg → admin publiserer case).
- Strukturert tilgjengelighets- og ytelsesgjennomgang, og en eksplisitt sikkerhetsgjennomgang
  av alle admin-ruter og rate limits.

## Filoversikt (komplett)

```
neoncrate/
├── .env.example  .gitignore  DESIGN.md  README.md
├── docker-compose.yml  nuxt.config.ts  package.json
├── playwright.config.ts  tailwind.config.ts  tsconfig.json  vitest.config.ts
├── app/
│   ├── app.vue
│   ├── assets/css/tokens.css
│   ├── components/{RarityBadge,CaseOpeningReel}.vue
│   ├── composables/useMarketEvents.ts
│   ├── layouts/default.vue
│   ├── middleware/admin.ts
│   └── pages/
│       ├── index.vue  login.vue  dashboard.vue
│       ├── cases/{index,[slug]}.vue
│       ├── inventory/index.vue
│       ├── market/index.vue
│       ├── leaderboards/index.vue
│       ├── u/[username].vue
│       └── admin/index.vue
├── prisma/
│   ├── schema.prisma  seed.ts
│   └── seed-data/{skins,cases}.ts
├── server/
│   ├── api/
│   │   ├── auth/[...].ts
│   │   ├── wallet/{balance.get,transactions.get,daily-bonus.post}.ts
│   │   ├── cases/{index.get,[slug].get,[slug]/open.post}.ts
│   │   ├── inventory/{index.get,[id]/{favorite,lock}.patch}.ts
│   │   ├── market/{index.get,index.post,mine.get,[id]/{buy,cancel}.post,price-history/[skinId].get}.ts
│   │   ├── leaderboards/index.get.ts
│   │   ├── achievements/index.get.ts
│   │   ├── missions/{index.get,[slug]/claim.post}.ts
│   │   ├── notifications/index.get.ts
│   │   ├── profile/index.get.ts  users/[username].get.ts
│   │   └── admin/
│   │       ├── wallet-adjustment.post.ts
│   │       ├── skins/{index.get,index.post}.ts
│   │       ├── cases/{index.get,index.post,[id]/{publish.post,status.patch}}.ts
│   │       ├── users/{index.get,[id]/suspend.post}.ts
│   │       ├── economy/index.get.ts
│   │       └── audit-log/index.get.ts
│   ├── routes/ws/market.ts
│   ├── repositories/{wallet,audit-log,catalog,inventory,market,social,admin}.repository.ts
│   ├── services/{wallet,case,inventory,market,social,profile,admin,errors}.ts
│   └── utils/{prisma,redis,auth-options,require-auth,rng,case-odds,market-events}.ts
├── types/
│   ├── dto.ts  next-auth.d.ts
│   └── schemas/{wallet,case,market,admin}.ts
└── tests/
    ├── unit/{wallet,market}.service.test.ts   (DB-baserte, ikke kjørt her)
    ├── unit/{rng,case-seed-data}.test.ts       (rene, faktisk kjørt og grønne)
    └── e2e/daily-bonus.spec.ts
```
