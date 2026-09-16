import bcrypt from 'bcryptjs'
import { prisma } from '~~/server/utils/prisma'
import { displayNameSchema, passwordSchema } from '~~/types/schemas/auth'
import { walletService } from './wallet.service'

// The User row still requires a unique e-mail (Auth.js's Prisma adapter
// expects one), so name-only accounts get a deterministic local address
// derived from the name. Nothing is ever sent to it.
const IDENTITY_EMAIL_DOMAIN = 'neoncrate.local'
const BCRYPT_ROUNDS = 10

export const userService = {
  /**
   * Name *and* password: entering the same name+password resolves to the
   * same account, which is what makes a player's balance, inventory and
   * stats persist between sessions. Matching the name is case-insensitive
   * so "Jonas" and "jonas" are the same person, while the casing they typed
   * is kept for display.
   *
   * Every account created before password support shipped has no
   * passwordHash yet — the first login attempt for such a name *sets* the
   * password from whatever was typed (a one-time claim), rather than
   * rejecting it. A brand-new name works the same way: it creates the
   * account and sets that password. An account that already has a password
   * requires it to match.
   *
   * Returns null on a wrong password for an already-claimed account, or on
   * an invalid name/password. Never throws for a normal auth failure —
   * that's what null means to the caller.
   */
  async authenticate(rawName: string, rawPassword: string) {
    const parsedName = displayNameSchema.safeParse(rawName)
    const parsedPassword = passwordSchema.safeParse(rawPassword)
    if (!parsedName.success || !parsedPassword.success) return null
    const username = parsedName.data
    const password = parsedPassword.data

    const existing = await this.findByName(username)

    if (existing) {
      if (existing.passwordHash) {
        const matches = await bcrypt.compare(password, existing.passwordHash)
        return matches ? existing : null
      }
      // Claim: this account predates passwords, or an earlier claim attempt
      // never completed. First correct-shaped login wins.
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      return prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    let user
    try {
      user = await prisma.user.create({
        data: { username, email: `${username.toLowerCase()}@${IDENTITY_EMAIL_DOMAIN}`, passwordHash },
      })
    } catch {
      // Two tabs racing the same brand-new name: one insert wins the unique
      // constraint, the other just reads back the row that won (and treats
      // it like an existing account whose password may not match).
      const raced = await this.findByName(username)
      if (!raced) throw new Error(`Kunne ikke opprette eller finne bruker "${username}"`)
      if (!raced.passwordHash) return raced
      return (await bcrypt.compare(password, raced.passwordHash)) ? raced : null
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
