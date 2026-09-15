import type { H3Event } from 'h3'
import { getServerSession } from '#auth'
import type { Role } from '@prisma/client'

/**
 * Every mutating or user-scoped route must call this first. Admin UI hiding
 * a button is not authorization — this is the actual enforcement point.
 */
export async function requireUser(event: H3Event) {
  const session = await getServerSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Ikke innlogget' })
  }
  if (session.user.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, statusMessage: 'Kontoen er suspendert eller utestengt' })
  }
  return session.user
}

export async function requireRole(event: H3Event, allowed: Role[]) {
  const user = await requireUser(event)
  if (!allowed.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Ingen tilgang' })
  }
  return user
}
