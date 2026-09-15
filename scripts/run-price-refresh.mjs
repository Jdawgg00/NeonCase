import { pricingService } from '../server/services/pricing.service.ts'

const result = await pricingService.refreshAllPrices()
console.log(`Done: updated ${result.updated}/${result.total} skins (${result.failed} failed).`)
