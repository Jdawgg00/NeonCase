import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export const auditLogRepository = {
  record(
    input: {
      actorId: string
      targetId?: string
      action: string
      reason?: string
      metadata?: Prisma.InputJsonValue
    },
    db: Db = prisma,
  ) {
    return db.auditLog.create({ data: input })
  },
}
