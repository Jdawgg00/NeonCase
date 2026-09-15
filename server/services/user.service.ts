import { prisma } from '~~/server/utils/prisma'
import { displayNameSchema } from '~~/types/schemas/auth'
import { walletService } from './wallet.service'

// The User row still requires a unique e-mail (Auth.js's Prisma adapter
// expects one), so name-only accounts get a deterministic local address
// derived from the name. Nothing is ever sent to it.
const IDENTITY_EMAIL_DOMAIN = 'neoncrate.local'

export const userService = {
  /**
   * Name-only identity: entering the same name again resolves to the same
   * account, which is what makes a player's balance, inventory and stats
   * persist between sessions. Matching is case-insensitive so "Jonas" and
   * "jonas" are the same person, while the casing they typed is kept for
   * display. Returns null if the name isn't valid.
   */
  async findOrCreateByName(rawName: string) {
    const parsed = displayNameSchema.safeParse(rawName)
    if (!parsed.success) return null
    const username = parsed.data

    const existing = await this.findByName(username)
    if (existing) return existing

    let user
    try {
      user = await prisma.user.create({
        data: { username, email: `${username.toLowerCase()}@${IDENTITY_EMAIL_DOMAIN}` },
      })
    } catch {
      // Two tabs racing the same brand-new name: one insert wins the unique
      // constraint, the other just reads back the row that won.
      const raced = await this.findByName(username)
      if (!raced) throw new Error(`Kunne ikke opprette eller finne bruker "${username}"`)
      return raced
    }

    // Every economic action (opening a case, buying/selling) assumes a
    // wallet already exists and fails hard if it doesn't — so a brand-new
    // account needs one immediately, not lazily on first dashboard visit.
    await walletService.getOrCreateWallet(user.id)
    return user
  },

  findByName(username: string) {
    return prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } })
  },
}
