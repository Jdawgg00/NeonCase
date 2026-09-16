import { prisma } from '~~/server/utils/prisma'
import { catalogRepository } from '~~/server/repositories/catalog.repository'
import { inventoryRepository } from '~~/server/repositories/inventory.repository'
import { applyBalanceDeltaTx, withOptimisticRetry } from './wallet.service'
import { generateFloatValue, generatePatternSeed, selectWeightedDrop, wearFromFloat } from '~~/server/utils/rng'
import { ValidationError } from './errors'
import { socialService } from './social.service'

export class CaseNotAvailableError extends Error {
  constructor(message = 'Denne casen er ikke tilgjengelig for øyeblikket') {
    super(message)
    this.name = 'CaseNotAvailableError'
  }
}

export const caseService = {
  async getActiveCases() {
    return catalogRepository.listActiveCases()
  },

  async getCaseDetail(slug: string) {
    const caseDefinition = await catalogRepository.findCaseBySlug(slug)
    if (!caseDefinition) throw new CaseNotAvailableError('Fant ikke casen')

    const version = await catalogRepository.findPublishedVersion(caseDefinition.id)
    if (!version) throw new CaseNotAvailableError('Denne casen har ingen publisert versjon ennå')

    return { caseDefinition, version }
  },

  /**
   * The 15-step flow from spesifikasjonen — steps 1-3 (auth, zod validation,
   * rate limit) happen in the API route before this is called. Steps 4-14
   * happen here, atomically. Step 15 (safe DTO) is built by the API route
   * from what this returns.
   */
  async openCase(input: { userId: string; caseSlug: string; idempotencyKey: string }) {
    if (!input.idempotencyKey || input.idempotencyKey.length < 10) {
      throw new ValidationError('idempotencyKey mangler eller er for kort')
    }

    // Idempotent replay: a retried request with the same key returns the
    // original result instead of opening a second case.
    const existingOpening = await prisma.caseOpening.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { inventoryItem: { include: { skinDefinition: true } } },
    })
    if (existingOpening) return { opening: existingOpening, replay: true }

    const opening = await withOptimisticRetry(() =>
      prisma.$transaction(async (tx) => {
        // Case + its published drop table in a single round-trip, read inside
        // the transaction so a concurrent admin re-publish can't change the
        // odds mid-flight for this specific opening. Every query here costs a
        // full round-trip to the database, so they're worth merging.
        const caseDefinition = await catalogRepository.findCaseWithPublishedVersion(input.caseSlug, tx)
        if (!caseDefinition || caseDefinition.status !== 'ACTIVE') throw new CaseNotAvailableError()

        const version = caseDefinition.versions[0]
        if (!version || version.drops.length === 0) throw new CaseNotAvailableError()

        const totalCost = caseDefinition.casePrice + (caseDefinition.keyPrice ?? 0)

        // Debit cost — reuses the exact same atomic, insufficient-funds-safe
        // primitive as every other economic operation in the app.
        await applyBalanceDeltaTx(tx, {
          userId: input.userId,
          amount: -totalCost,
          type: 'CASE_PURCHASE',
          idempotencyKey: `${input.idempotencyKey}:debit`,
          referenceType: 'CASE_OPENING',
          referenceId: caseDefinition.id,
        })

        const { skinDefinitionId, roll } = selectWeightedDrop(
          version.drops.map((d) => ({ skinDefinitionId: d.skinDefinitionId, weight: d.weight })),
          version.totalWeight,
        )
        const skin = version.drops.find((d) => d.skinDefinitionId === skinDefinitionId)!.skinDefinition

        const floatValue = generateFloatValue(skin.minFloat, skin.maxFloat)
        const wear = wearFromFloat(floatValue)
        const patternSeed = generatePatternSeed()

        const inventoryItem = await inventoryRepository.create(
          {
            ownerId: input.userId,
            skinDefinitionId: skin.id,
            sourceType: 'CASE_OPENING',
            floatValue,
            wear,
            patternSeed,
            specialVariant: skin.specialEligible && skin.rarity === 'SPECIAL' ? 'special' : undefined,
          },
          tx,
        )

        return tx.caseOpening.create({
          data: {
            userId: input.userId,
            caseId: caseDefinition.id,
            caseVersionId: version.id,
            inventoryItemId: inventoryItem.id,
            totalCost,
            randomRoll: roll,
            idempotencyKey: input.idempotencyKey,
          },
          include: { inventoryItem: { include: { skinDefinition: true } } },
        })
      }),
    )

    // Achievements/missions are non-critical side effects — they must never
    // roll back or fail the economic result the player already paid for and
    // received. Deliberately *not* awaited: they cost several more database
    // round-trips (~1.4s of the response time when measured), and the player
    // is watching a reel animation that outlasts them either way. Any credits
    // they award land a moment later and show up on the next balance read.
    void (async () => {
      try {
        const totalOpenings = await prisma.caseOpening.count({ where: { userId: input.userId } })
        await socialService.onCaseOpened(input.userId, totalOpenings)
        await socialService.checkInventoryMilestones(input.userId)
        if (opening.inventoryItem.skinDefinition.rarity === 'SPECIAL') {
          await socialService.onSpecialDrop(input.userId)
        }
      } catch (err) {
        console.error('social hook failed after case opening (non-fatal):', err)
      }
    })()

    return { opening, replay: false }
  },
}
