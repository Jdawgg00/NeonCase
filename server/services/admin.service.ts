import { prisma } from '~~/server/utils/prisma'
import { catalogRepository } from '~~/server/repositories/catalog.repository'
import { adminRepository } from '~~/server/repositories/admin.repository'
import { auditLogRepository } from '~~/server/repositories/audit-log.repository'
import { ValidationError } from './errors'

export const adminService = {
  listUsers() {
    return adminRepository.listUsers()
  },

  listSkins() {
    return catalogRepository.listAllSkins()
  },

  listCases() {
    return catalogRepository.listAllCases()
  },

  createSkin(input: {
    slug: string
    name: string
    weaponCategory: string
    rarity: string
    baseReferenceValue: number
    imageUrl?: string
  }) {
    return catalogRepository.createSkin({
      slug: input.slug,
      name: input.name,
      weaponCategory: input.weaponCategory as never,
      rarity: input.rarity as never,
      baseReferenceValue: input.baseReferenceValue,
      imageUrl: input.imageUrl,
      specialEligible: input.rarity === 'SPECIAL',
    })
  },

  createCase(input: { slug: string; name: string; description: string; casePrice: number; keyPrice?: number }) {
    return catalogRepository.createCase({
      slug: input.slug,
      name: input.name,
      description: input.description,
      casePrice: input.casePrice,
      keyPrice: input.keyPrice,
      status: 'DRAFT',
    })
  },

  /**
   * Publishes a new versioned drop table for a case. Never mutates a past
   * version — historical CaseOpenings keep pointing at the CaseVersion they
   * were actually rolled against, exactly as the spec requires.
   */
  async publishNewVersion(input: { caseId: string; createdBy: string; drops: { skinDefinitionId: string; weight: number }[] }) {
    if (input.drops.length === 0) throw new ValidationError('En case-versjon må ha minst én drop')
    if (input.drops.some((d) => !Number.isInteger(d.weight) || d.weight < 0)) {
      throw new ValidationError('Alle vekter må være ikke-negative heltall')
    }

    return prisma.$transaction(async (tx) => {
      const nextVersion = await catalogRepository.nextVersionNumber(input.caseId, tx)
      const version = await catalogRepository.createVersionWithDrops(
        { caseId: input.caseId, version: nextVersion, createdBy: input.createdBy, drops: input.drops },
        tx,
      )
      const published = await catalogRepository.publishVersion(version.id, tx)
      await auditLogRepository.record(
        { actorId: input.createdBy, action: 'CASE_VERSION_PUBLISHED', metadata: { caseId: input.caseId, versionId: version.id } },
        tx,
      )
      return published
    })
  },

  setCaseStatus(caseId: string, status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') {
    return catalogRepository.setCaseStatus(caseId, status)
  },

  async suspendUser(input: { actorId: string; targetUserId: string; status: 'SUSPENDED' | 'BANNED' | 'ACTIVE'; reason: string }) {
    if (input.reason.trim().length < 10) throw new ValidationError('reason må forklare handlingen med minst 10 tegn')

    return prisma.$transaction(async (tx) => {
      const user = await adminRepository.setUserStatus(input.targetUserId, input.status, tx)
      await auditLogRepository.record(
        { actorId: input.actorId, targetId: input.targetUserId, action: `USER_STATUS_${input.status}`, reason: input.reason },
        tx,
      )
      return user
    })
  },

  economyReport() {
    return adminRepository.economySnapshot()
  },

  auditLog(take?: number) {
    return adminRepository.listAuditLog(take)
  },
}
