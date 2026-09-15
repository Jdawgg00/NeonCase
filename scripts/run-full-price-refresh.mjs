import { pricingService } from '../server/services/pricing.service.ts'

const skinResult = await pricingService.refreshAllPrices()
console.log(`Skins: updated ${skinResult.updated}/${skinResult.total} (${skinResult.failed} failed).`)

const caseResult = await pricingService.refreshCasePrices()
console.log(`Cases: updated ${caseResult.updated}/${caseResult.total} (${caseResult.failed} failed).`)
