import type { Prisma, UserStatus } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type Db = Prisma.TransactionClient | typeof prisma

export const adminRepository = {
  listUsers(take = 100, db: Db = prisma) {
    return db.user.findMany({
      select: { id: true, username: true, email: true, role: true, status: true },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },

  setUserStatus(userId: string, status: UserStatus, db: Db = prisma) {
    return db.user.update({ where: { id: userId }, data: { status } })
  },

  listAuditLog(take = 50, db: Db = prisma) {
    return db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { username: true } }, target: { select: { username: true } } },
    })
  },

  async economySnapshot(db: Db = prisma) {
    const [walletAgg, users24h, openings24h, marketAgg24h, activeUsers] = await Promise.all([
      db.wallet.aggregate({ _sum: { balance: true }, _avg: { balance: true } }),
      db.walletTransaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _sum: { amount: true },
      }),
      db.caseOpening.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      db.marketSale.aggregate({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _sum: { grossAmount: true },
        _avg: { grossAmount: true },
      }),
      db.user.count({ where: { status: 'ACTIVE' } }),
    ])

    const created24h = users24h.filter((t) => t._sum.amount && t._sum.amount > 0).reduce((sum, t) => sum + (t._sum.amount ?? 0), 0)
    const removed24h = users24h.filter((t) => t._sum.amount && t._sum.amount < 0).reduce((sum, t) => sum + Math.abs(t._sum.amount ?? 0), 0)

    return {
      totalCreditsInCirculation: walletAgg._sum.balance ?? 0,
      averageBalance: Math.round(walletAgg._avg.balance ?? 0),
      creditsCreated24h: created24h,
      creditsRemoved24h: removed24h,
      caseOpenings24h: openings24h,
      marketVolume24h: marketAgg24h._sum.grossAmount ?? 0,
      averageMarketPrice24h: Math.round(marketAgg24h._avg.grossAmount ?? 0),
      activeUsers,
    }
  },
}
