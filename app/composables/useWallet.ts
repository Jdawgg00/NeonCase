import type { WalletDTO } from '~~/types/dto'

/**
 * Shared wallet balance — every caller uses the same `key`, so Nuxt's data
 * cache is shared across them: refreshing after a case open, market buy or
 * daily bonus claim on any page updates the balance shown everywhere else,
 * including the persistent header display, without extra plumbing.
 */
export function useWallet() {
  return useFetch<WalletDTO>('/api/wallet/balance', { key: 'wallet-balance' })
}
