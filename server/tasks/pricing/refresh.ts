export default defineTask({
  meta: {
    name: 'pricing:refresh',
    description: 'Refresh Steam Community Market reference prices for every skin.',
  },
  async run() {
    const { pricingService } = await import('~~/server/services/pricing.service')
    const skinResult = await pricingService.refreshAllPrices()
    console.log(`[pricing:refresh] updated ${skinResult.updated}/${skinResult.total} skins (${skinResult.failed} failed).`)
    const caseResult = await pricingService.refreshCasePrices()
    console.log(`[pricing:refresh] updated ${caseResult.updated}/${caseResult.total} case prices (${caseResult.failed} failed).`)
    return { result: { skinResult, caseResult } }
  },
})
