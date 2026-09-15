# NeonCrate — designsystem

## Konsept
NeonCrate er ikke et kasino — det er et internt "vault"-tema: låste kasser, kretskort og
signallys. Vinkelen er teknisk/industriell (hex-merker, diagonale sømmer, tynne linjer)
snarere enn myke, runde "SaaS-kort". Sjeldenhet vises som *signalstyrke* — jo sjeldnere
skin, jo sterkere glød og jo skarpere vinkel på merket.

## Farger (base-palett)
| Token | Hex | Bruk |
|---|---|---|
| `--gc-graphite-950` | `#0A0C11` | Sidebakgrunn |
| `--gc-graphite-900` | `#12151C` | Paneler, navigasjon |
| `--gc-graphite-800` | `#1B1F29` | Kort, skillelinjer |
| `--gc-steel-700` | `#2A2F3C` | Borders |
| `--gc-text` | `#E7E9EE` | Primær tekst |
| `--gc-text-muted` | `#8A90A0` | Sekundær tekst |
| `--gc-cyan` | `#34D5C9` | Uncommon / info / lenker |
| `--gc-violet` | `#8B6BFF` | Rare |
| `--gc-magenta` | `#E84FA0` | Epic |
| `--gc-gold` | `#F0B429` | Special / knife-tier |
| `--gc-common` | `#6B7280` | Common (bevisst dempet — ikke alt skal glø) |

Kun *rarity* og primærhandlinger får farge og glød. Resten av UI er nøytral graphite,
slik at fargebruken faktisk betyr noe (spesielt viktig når ekte odds skal formidles ærlig).

## Typografi
- **Display/tall/rarity-labels:** `Chakra Petch` — vinklet, teknisk, leser som et HUD.
  Brukes på priser, resultatkort og seksjonsoverskrifter.
- **Brødtekst/UI:** `Inter` — nøytral og svært lesbar i skjemaer, tabeller og lange lister.

To skrifter, tydelig forskjellige roller — Chakra Petch bærer personlighet, Inter bærer
lesbarhet. Ingen tredje skrift, ingen bruk av caps-lock-labels for å simulere hierarki.

## Ikon-/merkestil
Sekskantede (hex) rarity-merker med rett vinkel — ikke runde badges. Strekikoner (1.5px),
ingen filled/glossy stil. Et hex-merke er også en original erstatning for CS-stjernen/
patch-estetikken uten å kopiere den.

## Layout
Asymmetrisk, venstrejustert — ikke sentrert hero-tekst. Heroen på landingssiden bruker et
diagonalt "vault-seam"-kutt mellom tekstpanel og et illustrert kasse-hjørne, i stedet for
et sentrert stort tall + gradient (den vanligste AI-genererte defaulten).

```
+-------------------------------------------+
| logo            nav             [Logg inn]|
+-------------------+-----------------------+
| Overskrift        |                       |
| venstrejustert,   |    [illustrert        |
| kort ingress      |     crate-hjørne,     |
| [Opprett konto]   |     diagonalt kuttet] |
+-------------------+-----------------------+
```

## Bevegelse
Ingen automatiske "fade-in on scroll" på hver seksjon. De eneste orkestrerte bevegelsene:
1. Case-opening-hjulet (GSAP, ett presist forløp, aldri gjentakende).
2. Resultatkortet som "låses opp" når det stopper.
Alt annet er direkte respons på handling (åpne modal, hover på et kort du faktisk peker på),
og alt respekterer `prefers-reduced-motion`.
