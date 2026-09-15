import { pricingService } from '../server/services/pricing.service.ts'

const result = await pricingService.refreshCasePrices()
console.log(`Done: updated ${result.updated}/${result.total} case prices (${result.failed} failed).`)
