import { requireRole } from '~~/server/utils/require-auth'
import { pricingService } from '~~/server/services/pricing.service'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  // Fire-and-forget — a full catalog refresh takes minutes (one throttled
  // request per skin), far longer than any reasonable HTTP timeout. The
  // scheduled task (server/tasks/pricing/refresh.ts) covers the routine
  // case; this lets an admin kick one off on demand instead of waiting for
  // the next cron tick.
  pricingService
    .refreshAllPrices()
    .then(() => pricingService.refreshCasePrices())
    .catch((err) => console.error('[admin] pricing refresh failed:', err))

  return { started: true }
})
