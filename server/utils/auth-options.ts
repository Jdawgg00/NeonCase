import { createRequire } from 'node:module'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import type { AuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { userService } from '~~/server/services/user.service'

// next-auth v4 ships providers as CJS modules; under Nitro's native ESM
// loader a default import resolves to the whole `exports` object instead of
// `exports.default`, so `CredentialsProvider(...)` throws "is not a function".
// Load via createRequire to get the real CJS `module.exports.default` value.
//
// createRequire needs an absolute filename to resolve node_modules from, but
// not necessarily *this* file's — process.cwd() (the app's working directory
// at runtime, which always has node_modules above or alongside it) works
// just as well. import.meta.url looked more "correct" but is unsafe here:
// Nitro's bundler shares this chunk across multiple route entrypoints and
// rewrites import.meta.url to a synthetic placeholder ("file:///_entry.js")
// in that case, which newer Node versions reject as an invalid createRequire
// argument, crashing the server on boot.
const require = createRequire(`${process.cwd()}/package.json`)
const CredentialsProvider = require('next-auth/providers/credentials').default
const EmailProvider = require('next-auth/providers/email').default
const GoogleProvider = require('next-auth/providers/google').default
const AzureADProvider = require('next-auth/providers/azure-ad').default

/**
 * Central Auth.js config.
 *
 * - The primary login is the `name` provider below: players type a name and
 *   that name *is* the account, so their progress persists. There's no
 *   password, so it's trust-based by design — fine for an internal office
 *   game, but note anyone who types an existing name gets that account.
 * - `next-auth` is pinned to v4.21.1 to match @sidebase/nuxt-auth's peer
 *   dependency. That version still ships the provider under its old id
 *   `azure-ad` — Microsoft has since renamed the underlying service to
 *   "Microsoft Entra ID", but it's the same provider/endpoint.
 * - The OAuth/e-mail providers stay configured but are only enabled when
 *   their env vars are set, and aren't surfaced on /login — they're here for
 *   the day this wants real accounts instead of name-only identity.
 * - Every provider resolves to the same Prisma `User` row, so role/status
 *   checks downstream never need to know which provider was used.
 */
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Without this, NuxtAuthHandler falls back to the literal string "secret"
  // in dev and silently re-derives a fresh one on every server rebuild in
  // some setups — either way, every JWT session issued before that point
  // stops verifying, logging everyone out. AUTH_SECRET must be a fixed
  // value in .env for sessions to survive a restart/deploy.
  secret: process.env.AUTH_SECRET,
  // next-auth v4 requires the jwt strategy whenever CredentialsProvider is
  // configured (see assertConfig in next-auth/core/lib/assert.js) — database
  // strategy + credentials throws CALLBACK_CREDENTIALS_JWT_ERROR on every
  // /api/auth/* request. The session callback below still re-reads
  // role/status/username from Postgres on every call, so nothing from the
  // token itself is ever trusted — same freshness guarantee as before.
  // Long-lived on purpose: "remember me" is the whole point of name-only
  // login — a returning player should land straight in the game rather than
  // having to retype their name every month.
  session: { strategy: 'jwt', maxAge: 365 * 24 * 60 * 60 }, // 1 year
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(process.env.MICROSOFT_ENTRA_CLIENT_ID
      ? [
          AzureADProvider({
            clientId: process.env.MICROSOFT_ENTRA_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_ENTRA_CLIENT_SECRET!,
            tenantId: process.env.MICROSOFT_ENTRA_TENANT_ID,
          }),
        ]
      : []),
    ...(process.env.EMAIL_SERVER
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER,
            from: process.env.EMAIL_FROM,
          }),
        ]
      : []),
    // Primary login: just a name. First time creates the account, every
    // time after resolves to that same account so progress carries over.
    CredentialsProvider({
      id: 'name',
      name: 'Navn',
      credentials: {
        username: { label: 'Navn', type: 'text' },
      },
      async authorize(credentials: Record<'username', string> | undefined) {
        const user = await userService.findOrCreateByName(credentials?.username ?? '')
        if (!user) return null
        return { id: user.id, email: user.email, name: user.username, image: user.image }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    async session({ session, token }) {
      // Re-fetch role/status/username fresh on every session read so an
      // admin suspension or role change takes effect immediately — never
      // trust stale values baked into the JWT.
      const userId = token.sub
      if (!userId) return session
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true, username: true },
      })
      if (dbUser && session.user) {
        session.user.id = userId
        session.user.role = dbUser.role
        session.user.status = dbUser.status
        session.user.username = dbUser.username
      }
      return session
    },
    async signIn({ user }) {
      // Block suspended/banned accounts at the door, not just in the UI.
      if (!user.email) return false
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
      if (dbUser?.status === 'SUSPENDED' || dbUser?.status === 'BANNED') return false
      return true
    },
  },
}
